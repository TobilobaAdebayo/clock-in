import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../../config/env.js';
import { generateToken, hashToken } from '../../shared/utils/crypto.js';

export interface AuthUserPayload {
  staffId: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface TotpLoginPayload {
  staffId: string;
  scope: 'TOTP_LOGIN';
}

export interface TotpSetupPayload {
  staffId: string;
  encryptedSecret: string;
  scope: 'TOTP_SETUP';
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
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<
        AuthUserPayload & { scope?: string }
      >;
      if (decoded.scope || !decoded.staffId || !decoded.email || !decoded.role) {
        return null;
      }
      return decoded as AuthUserPayload;
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
   * Generates a short-lived signed token for the Google Authenticator login step (5 minutes).
   */
  generateTotpLoginToken(staffId: string): string {
    return jwt.sign({ staffId, scope: 'TOTP_LOGIN' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '5m',
    });
  }

  /**
   * Verifies a Google Authenticator login challenge token.
   */
  verifyTotpLoginToken(token: string): TotpLoginPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<TotpLoginPayload>;
      if (decoded.scope !== 'TOTP_LOGIN' || !decoded.staffId) {
        return null;
      }
      return decoded as TotpLoginPayload;
    } catch {
      return null;
    }
  }

  /**
   * Generates a signed setup token carrying the encrypted pending TOTP secret (15 minutes).
   */
  generateTotpSetupToken(staffId: string, encryptedSecret: string): string {
    return jwt.sign({ staffId, encryptedSecret, scope: 'TOTP_SETUP' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
  }

  /**
   * Verifies a Google Authenticator setup token.
   */
  verifyTotpSetupToken(token: string): TotpSetupPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<TotpSetupPayload>;
      if (decoded.scope !== 'TOTP_SETUP' || !decoded.staffId || !decoded.encryptedSecret) {
        return null;
      }
      return decoded as TotpSetupPayload;
    } catch {
      return null;
    }
  }
}

export const tokenService = new TokenService();
