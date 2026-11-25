import crypto from 'node:crypto';
import { Role, Staff, TwoFactorPurpose } from '@prisma/client';
import { staffRepository, StaffRepository } from '../staff/staff.repository.js';
import { sessionRepository, SessionRepository } from './session.repository.js';
import { twoFactorRepository, TwoFactorRepository } from './two-factor.repository.js';
import { tokenService, TokenService } from './token.service.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import { prisma } from '../../shared/db/prisma.js';
import { verifyPassword, hashToken } from '../../shared/utils/crypto.js';
import {
  mailerService,
  maskEmail,
  TwoFactorEmailParams,
  EmailDeliveryResult,
} from '../../shared/utils/mailer.js';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error.js';

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

export interface AuthenticatedStaffSummary {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
}

export interface LoginSuccessResult {
  requiresTwoFactor: false;
  accessToken: string;
  refreshToken: string;
  staff: AuthenticatedStaffSummary;
}

export interface LoginChallengeResult {
  requiresTwoFactor: true;
  challengeToken: string;
  maskedEmail: string;
  expiresInSeconds: number;
  devPreviewCode?: string;
}

export type LoginResult = LoginSuccessResult | LoginChallengeResult;

export interface TwoFactorStartResult {
  challengeToken: string;
  maskedEmail: string;
  expiresInSeconds: number;
  devPreviewCode?: string;
}

interface MailerService {
  sendTwoFactorCodeEmail: (params: TwoFactorEmailParams) => Promise<EmailDeliveryResult>;
}

export class AuthService {
  constructor(
    private staffRepo: StaffRepository = staffRepository,
    private sessionRepo: SessionRepository = sessionRepository,
    private tokens: TokenService = tokenService,
    private twoFactorRepo: TwoFactorRepository = twoFactorRepository,
    private audit: AuditService = auditService,
    private mailer: MailerService = mailerService,
  ) { }

  private generateSixDigitCode(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  private hashOtpCode(challengeId: string, code: string): string {
    return hashToken(`${challengeId}:${code.trim()}`);
  }

  private compareHashConstantTime(expectedHex: string, actualHex: string): boolean {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(actualHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  private async issueSession(staff: Staff): Promise<LoginSuccessResult> {
    const accessToken = this.tokens.generateAccessToken({
      staffId: staff.id,
      email: staff.email,
      role: staff.role,
      fullName: staff.fullName,
    });

    const rawRefreshToken = this.tokens.generateRefreshToken();
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionRepo.createSession({
      staffId: staff.id,
      tokenHash,
      expiresAt,
    });

    return {
      requiresTwoFactor: false,
      accessToken,
      refreshToken: rawRefreshToken,
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        twoFactorEnabled: Boolean(staff.twoFactorEnabled),
      },
    };
  }

  private async createAndSendChallenge(
    staff: Staff,
    purpose: TwoFactorPurpose,
  ): Promise<TwoFactorStartResult> {
    const challengeId = crypto.randomUUID();
    const code = this.generateSixDigitCode();
    const codeHash = this.hashOtpCode(challengeId, code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.twoFactorRepo.invalidatePendingForStaff(staff.id, purpose);
    await this.twoFactorRepo.createChallenge({
      id: challengeId,
      staffId: staff.id,
      purpose,
      codeHash,
      expiresAt,
    });

    const delivery = await this.mailer.sendTwoFactorCodeEmail({
      to: staff.email,
      fullName: staff.fullName,
      code,
      purpose,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });

    const challengeToken = this.tokens.generateTwoFactorToken({
      challengeId,
      staffId: staff.id,
      purpose,
    });

    return {
      challengeToken,
      maskedEmail: maskEmail(staff.email),
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      ...(delivery.devPreviewCode ? { devPreviewCode: delivery.devPreviewCode } : {}),
    };
  }

  private async verifyChallenge(
    challengeToken: string,
    code: string,
    expectedPurpose: TwoFactorPurpose,
    expectedStaffId?: string,
  ): Promise<{ staffId: string; challengeId: string }> {
    const payload = this.tokens.verifyTwoFactorToken(challengeToken);
    if (!payload || payload.purpose !== expectedPurpose) {
      throw new UnauthorizedError('Verification session is invalid or expired. Please request a new code.');
    }

    if (expectedStaffId && payload.staffId !== expectedStaffId) {
      throw new UnauthorizedError('Verification session does not belong to this account.');
    }

    const challenge = await this.twoFactorRepo.findById(payload.challengeId);
    if (!challenge || challenge.staffId !== payload.staffId || challenge.purpose !== expectedPurpose) {
      throw new UnauthorizedError('Verification session is invalid or expired. Please request a new code.');
    }

    if (challenge.consumedAt) {
      throw new UnauthorizedError('This verification code has already been used. Please request a new code.');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Verification code has expired. Please request a new code.');
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedError('Too many incorrect verification attempts. Please request a new code.');
    }

    const submittedHash = this.hashOtpCode(challenge.id, code);
    const matches = this.compareHashConstantTime(challenge.codeHash, submittedHash);

    if (!matches) {
      const updated = await this.twoFactorRepo.incrementAttempts(challenge.id);
      if (updated.attempts >= OTP_MAX_ATTEMPTS) {
        await this.twoFactorRepo.markConsumed(challenge.id);
        throw new UnauthorizedError('Too many incorrect verification attempts. Please request a new code.');
      }
      throw new UnauthorizedError('Invalid verification code. Please try again.');
    }

    await this.twoFactorRepo.markConsumed(challenge.id);
    return { staffId: challenge.staffId, challengeId: challenge.id };
  }

  /**
   * Signs in staff account (FR-08).
   * If Email 2FA is enabled on the account, sends a 6-digit email OTP challenge instead of issuing session tokens.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const genericError = new UnauthorizedError('Invalid email or password.');

    const staff = await this.staffRepo.findByEmail(email);
    if (!staff || !staff.isActive) {
      throw genericError;
    }

    const isPasswordValid = await verifyPassword(password, staff.passwordHash);
    if (!isPasswordValid) {
      throw genericError;
    }

    if (staff.twoFactorEnabled) {
      const challenge = await this.createAndSendChallenge(staff, TwoFactorPurpose.LOGIN);
      return {
        requiresTwoFactor: true,
        ...challenge,
      };
    }

    return this.issueSession(staff);
  }

  /**
   * Completes a 2FA-protected login using the 6-digit email code.
   */
  async verifyTwoFactorLogin(challengeToken: string, code: string): Promise<LoginSuccessResult> {
    const { staffId } = await this.verifyChallenge(challengeToken, code, TwoFactorPurpose.LOGIN);

    const staff = await this.staffRepo.findById(staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account not found or deactivated.');
    }

    return this.issueSession(staff);
  }

  /**
   * Resends a fresh 6-digit email login code for an active 2FA login challenge.
   */
  async resendTwoFactorLogin(challengeToken: string): Promise<LoginChallengeResult> {
    const payload = this.tokens.verifyTwoFactorToken(challengeToken);
    if (!payload || payload.purpose !== TwoFactorPurpose.LOGIN) {
      throw new UnauthorizedError('Verification session is invalid or expired. Please sign in again.');
    }

    const staff = await this.staffRepo.findById(payload.staffId);
    if (!staff || !staff.isActive || !staff.twoFactorEnabled) {
      throw new UnauthorizedError('Unable to resend verification code. Please sign in again.');
    }

    const challenge = await this.createAndSendChallenge(staff, TwoFactorPurpose.LOGIN);
    return {
      requiresTwoFactor: true,
      ...challenge,
    };
  }

  /**
   * Starts self-service Email 2FA enrollment by emailing a 6-digit verification code.
   */
  async startEnableTwoFactor(staffId: string): Promise<TwoFactorStartResult> {
    const staff = await this.staffRepo.findById(staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account not found or deactivated.');
    }

    if (staff.twoFactorEnabled) {
      throw new BadRequestError('Two-factor authentication is already enabled on this account.');
    }

    return this.createAndSendChallenge(staff, TwoFactorPurpose.ENABLE);
  }

  /**
   * Confirms self-service Email 2FA enrollment with the emailed 6-digit code.
   */
  async confirmEnableTwoFactor(
    staffId: string,
    challengeToken: string,
    code: string,
  ): Promise<AuthenticatedStaffSummary> {
    await this.verifyChallenge(challengeToken, code, TwoFactorPurpose.ENABLE, staffId);

    const staff = await this.staffRepo.findById(staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account not found or deactivated.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await this.staffRepo.update(staffId, { twoFactorEnabled: true }, tx);
      await this.audit.record(
        {
          actorId: staffId,
          action: 'ENABLE_2FA',
          recordType: 'STAFF',
          recordId: staffId,
          oldValues: { twoFactorEnabled: false },
          newValues: { twoFactorEnabled: true },
        },
        tx,
      );
      return saved;
    });

    return {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      twoFactorEnabled: updated.twoFactorEnabled,
    };
  }

  /**
   * Disables Email 2FA for the currently authenticated staff member after confirming their password.
   */
  async disableTwoFactor(staffId: string, password: string): Promise<AuthenticatedStaffSummary> {
    const staff = await this.staffRepo.findById(staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account not found or deactivated.');
    }

    if (!staff.twoFactorEnabled) {
      throw new BadRequestError('Two-factor authentication is already disabled on this account.');
    }

    const isPasswordValid = await verifyPassword(password, staff.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Incorrect password.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await this.staffRepo.update(staffId, { twoFactorEnabled: false }, tx);
      await this.twoFactorRepo.invalidatePendingForStaff(staffId, undefined, tx);
      await this.audit.record(
        {
          actorId: staffId,
          action: 'DISABLE_2FA',
          recordType: 'STAFF',
          recordId: staffId,
          oldValues: { twoFactorEnabled: true },
          newValues: { twoFactorEnabled: false },
        },
        tx,
      );
      return saved;
    });

    return {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      twoFactorEnabled: updated.twoFactorEnabled,
    };
  }

  /**
   * Rotates refresh token and issues a new access token.
   */
  async refresh(rawRefreshToken: string): Promise<LoginSuccessResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token required.');
    }

    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const session = await this.sessionRepo.findActiveByTokenHash(tokenHash);

    if (!session || !session.staff || !session.staff.isActive) {
      throw new UnauthorizedError('Invalid or expired refresh token. Please sign in again.');
    }

    // Token rotation: Revoke current session
    await this.sessionRepo.revokeSession(session.id);

    return this.issueSession(session.staff);
  }

  /**
   * Logs out staff member by revoking their current refresh token session.
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const session = await this.sessionRepo.findActiveByTokenHash(tokenHash);
    if (session) {
      await this.sessionRepo.revokeSession(session.id);
    }
  }

  /**
   * Retrieves profile for currently authenticated staff.
   */
  async getMe(staffId: string) {
    const staff = await this.staffRepo.findById(staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account not found or deactivated.');
    }

    return {
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      isActive: staff.isActive,
      twoFactorEnabled: Boolean(staff.twoFactorEnabled),
    };
  }
}

export const authService = new AuthService();
