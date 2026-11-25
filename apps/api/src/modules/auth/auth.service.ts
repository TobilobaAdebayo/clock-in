import { Role, Staff } from '@prisma/client';
import { staffRepository, StaffRepository } from '../staff/staff.repository.js';
import { sessionRepository, SessionRepository } from './session.repository.js';
import { tokenService, TokenService } from './token.service.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import { prisma } from '../../shared/db/prisma.js';
import { env } from '../../config/env.js';
import { verifyPassword } from '../../shared/utils/crypto.js';
import {
  generateTotpSecret,
  formatManualEntryKey,
  verifyTotpCode,
  buildOtpAuthUri,
  generateQrCodeDataUrl,
  encryptTotpSecret,
  decryptTotpSecret,
} from '../../shared/utils/totp.js';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error.js';

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
  expiresInSeconds: number;
}

export type LoginResult = LoginSuccessResult | LoginChallengeResult;

export interface TotpSetupResult {
  setupToken: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
  issuer: string;
  accountName: string;
}

export class AuthService {
  constructor(
    private staffRepo: StaffRepository = staffRepository,
    private sessionRepo: SessionRepository = sessionRepository,
    private tokens: TokenService = tokenService,
    private audit: AuditService = auditService,
  ) {}

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

  /**
   * Signs in staff account (FR-08).
   * If Google Authenticator 2FA is enabled, returns a short-lived challengeToken without issuing session tokens.
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

    if (staff.twoFactorEnabled && staff.twoFactorSecret) {
      const challengeToken = this.tokens.generateTotpLoginToken(staff.id);
      return {
        requiresTwoFactor: true,
        challengeToken,
        expiresInSeconds: 300,
      };
    }

    return this.issueSession(staff);
  }

  /**
   * Completes a 2FA-protected login using the 6-digit code from Google Authenticator.
   */
  async verifyTwoFactorLogin(challengeToken: string, code: string): Promise<LoginSuccessResult> {
    const payload = this.tokens.verifyTotpLoginToken(challengeToken);
    if (!payload) {
      throw new UnauthorizedError('Verification session expired. Please sign in again.');
    }

    const staff = await this.staffRepo.findById(payload.staffId);
    if (!staff || !staff.isActive || !staff.twoFactorEnabled || !staff.twoFactorSecret) {
      throw new UnauthorizedError('Unable to verify account. Please sign in again.');
    }

    let secret: string;
    try {
      secret = decryptTotpSecret(staff.twoFactorSecret);
    } catch {
      throw new UnauthorizedError('Two-factor configuration error. Contact a Super Admin to reset 2FA.');
    }

    if (!verifyTotpCode(secret, code)) {
      throw new UnauthorizedError('Invalid Google Authenticator code. Please try again.');
    }

    return this.issueSession(staff);
  }

  /**
   * Starts Google Authenticator setup by generating a QR code and manual entry key.
   */
  async startTotpSetup(staffId: string): Promise<TotpSetupResult> {
    const staff = await this.staffRepo.findById(staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account not found or deactivated.');
    }

    if (staff.twoFactorEnabled) {
      throw new BadRequestError('Two-factor authentication is already enabled on this account.');
    }

    const secret = generateTotpSecret();
    const issuer = env.WORKSPACE_NAME;
    const otpauthUrl = buildOtpAuthUri({
      issuer,
      accountName: staff.email,
      secret,
    });
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl);
    const encryptedSecret = encryptTotpSecret(secret);
    const setupToken = this.tokens.generateTotpSetupToken(staff.id, encryptedSecret);

    return {
      setupToken,
      qrCodeDataUrl,
      manualEntryKey: formatManualEntryKey(secret),
      issuer,
      accountName: staff.email,
    };
  }

  /**
   * Confirms Google Authenticator enrollment by verifying a live 6-digit code from the app.
   */
  async confirmTotpSetup(
    staffId: string,
    setupToken: string,
    code: string,
  ): Promise<AuthenticatedStaffSummary> {
    const payload = this.tokens.verifyTotpSetupToken(setupToken);
    if (!payload || payload.staffId !== staffId) {
      throw new UnauthorizedError('Setup session expired. Please generate a new QR code.');
    }

    const staff = await this.staffRepo.findById(staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account not found or deactivated.');
    }

    if (staff.twoFactorEnabled) {
      throw new BadRequestError('Two-factor authentication is already enabled on this account.');
    }

    let secret: string;
    try {
      secret = decryptTotpSecret(payload.encryptedSecret);
    } catch {
      throw new UnauthorizedError('Invalid setup session. Please generate a new QR code.');
    }

    if (!verifyTotpCode(secret, code)) {
      throw new UnauthorizedError('Invalid 6-digit code. Check Google Authenticator and try again.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await this.staffRepo.update(
        staffId,
        {
          twoFactorEnabled: true,
          twoFactorSecret: payload.encryptedSecret,
        },
        tx,
      );
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
   * Disables Google Authenticator 2FA after confirming the staff member's current password.
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
      const saved = await this.staffRepo.update(
        staffId,
        {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
        tx,
      );
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
