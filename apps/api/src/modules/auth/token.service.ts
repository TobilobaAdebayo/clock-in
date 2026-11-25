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
}

export const tokenService = new TokenService();
