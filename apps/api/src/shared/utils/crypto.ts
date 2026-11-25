import argon2 from 'argon2';
import crypto from 'node:crypto';

/**
 * Hashes a plain-text password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verifies a plain-text password against an Argon2id hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure random token (hex string).
 */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Produces a SHA-256 hash of a token string (used for RefreshToken database storage).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Produces an HMAC-SHA256 hex digest using the provided secret.
 * Used to verify sensitive values (such as visitor confirmation names) without storing plaintext in tokens.
 */
export function hmacDigest(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Constant-time string comparison for digests/signatures.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Signs a short-lived lookup token for returning-visitor identity confirmation.
 * Token structure: base64url(payload) . hmac_signature
 */
export function signLookupToken(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 300, // 5 minutes
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp: expiresAt };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes a lookup token. Returns null if invalid or expired.
 */
export function verifyLookupToken<T = Record<string, unknown>>(
  token: string,
  secret: string,
): T | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        return null; // Expired
      }
    }
    return payload as T;
  } catch {
    return null;
  }
}
