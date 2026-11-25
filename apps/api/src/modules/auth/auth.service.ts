import { Role } from '@prisma/client';
import { staffRepository, StaffRepository } from '../staff/staff.repository.js';
import { sessionRepository, SessionRepository } from './session.repository.js';
import { tokenService, TokenService } from './token.service.js';
import { verifyPassword } from '../../shared/utils/crypto.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  staff: {
    id: string;
    fullName: string;
    email: string;
    role: Role;
  };
}

export class AuthService {
  constructor(
    private staffRepo: StaffRepository = staffRepository,
    private sessionRepo: SessionRepository = sessionRepository,
    private tokens: TokenService = tokenService,
  ) {}

  /**
   * Signs in staff account (FR-08).
   * Validates Argon2id password hash, checks active state, and issues access + refresh tokens.
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

    // Generate tokens
    const accessToken = this.tokens.generateAccessToken({
      staffId: staff.id,
      email: staff.email,
      role: staff.role,
      fullName: staff.fullName,
    });

    const rawRefreshToken = this.tokens.generateRefreshToken();
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day refresh token

    await this.sessionRepo.createSession({
      staffId: staff.id,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
      },
    };
  }

  /**
   * Rotates refresh token and issues a new access token.
   */
  async refresh(rawRefreshToken: string): Promise<LoginResult> {
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

    // Issue new tokens
    const accessToken = this.tokens.generateAccessToken({
      staffId: session.staff.id,
      email: session.staff.email,
      role: session.staff.role,
      fullName: session.staff.fullName,
    });

    const newRawRefreshToken = this.tokens.generateRefreshToken();
    const newTokenHash = this.tokens.hashRefreshToken(newRawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionRepo.createSession({
      staffId: session.staff.id,
      tokenHash: newTokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      staff: {
        id: session.staff.id,
        fullName: session.staff.fullName,
        email: session.staff.email,
        role: session.staff.role,
      },
    };
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
    };
  }
}

export const authService = new AuthService();
