import jwt from 'jsonwebtoken';
import { Role, TwoFactorPurpose } from '@prisma/client';
import { env } from '../../config/env.js';
import { generateToken, hashToken } from '../../shared/utils/crypto.js';

export interface AuthUserPayload {
  staffId: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface TwoFactorChallengePayload {
  challengeId: string;
  staffId: string;
  purpose: TwoFactorPurpose;
  scope: '2FA_CHALLENGE';
}

export class TokenService {
  /**
   * Generates a short-lived access JWT (15 minutes).
   */
  generateAccessToken(payload: AuthUserPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
  }

  /**
   * Verifies and decodes an access JWT. Returns null if invalid or expired.
   */
  verifyAccessToken(token: string): AuthUserPayload | null {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUserPayload;
    } catch {
      return null;
    }
  }

  /**
   * Generates a secure random refresh token.
   */
  generateRefreshToken(): string {
    return generateToken(40);
  }

  /**
   * Hashes a refresh token using SHA-256 for secure database storage.
   */
  hashRefreshToken(token: string): string {
    return hashToken(token);
  }

  /**
   * Generates a short-lived signed token bound to a 2FA email OTP challenge (10 minutes).
   */
  generateTwoFactorToken(payload: Omit<TwoFactorChallengePayload, 'scope'>): string {
    return jwt.sign({ ...payload, scope: '2FA_CHALLENGE' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '10m',
    });
  }

  /**
   * Verifies a 2FA challenge token. Returns null if invalid, expired, or wrong scope.
   */
  verifyTwoFactorToken(token: string): TwoFactorChallengePayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<TwoFactorChallengePayload>;
      if (
        decoded.scope !== '2FA_CHALLENGE' ||
        !decoded.challengeId ||
        !decoded.staffId ||
        !decoded.purpose
      ) {
        return null;
      }
      return decoded as TwoFactorChallengePayload;
    } catch {
      return null;
    }
  }
}

export const tokenService = new TokenService();
