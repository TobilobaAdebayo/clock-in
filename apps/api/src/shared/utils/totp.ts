import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (input: string): Buffer => {
  const cleaned = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid Base32 character in TOTP secret');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

/**
 * Generates a cryptographically secure 160-bit Base32 TOTP secret compatible with Google Authenticator.
 */
export const generateTotpSecret = (byteLength = 20): string => {
  return base32Encode(crypto.randomBytes(byteLength));
};

/**
 * Formats a Base32 secret into 4-character groups for easy manual entry in Google Authenticator.
 */
export const formatManualEntryKey = (secret: string): string => {
  return secret
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
};

/**
 * Computes a 6-digit RFC 6238 TOTP code for a given Base32 secret and timestamp.
 */
export const generateTotpCode = (
  secret: string,
  timestampMs: number = Date.now(),
  stepSeconds: number = TOTP_STEP_SECONDS,
): string => {
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** TOTP_DIGITS;
  return String(otp).padStart(TOTP_DIGITS, '0');
};

/**
 * Verifies a 6-digit Google Authenticator TOTP code with +/- 1 step (30s) clock drift tolerance.
 */
export const verifyTotpCode = (
  secret: string,
  code: string,
  windowSteps = 1,
  timestampMs: number = Date.now(),
): boolean => {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const submittedBuf = Buffer.from(normalized, 'utf8');

  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const expected = generateTotpCode(secret, timestampMs + delta * TOTP_STEP_SECONDS * 1000);
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (crypto.timingSafeEqual(submittedBuf, expectedBuf)) {
      return true;
    }
  }

  return false;
};

/**
 * Builds the standard otpauth:// URI recognized by Google Authenticator.
 */
export const buildOtpAuthUri = (params: {
  issuer: string;
  accountName: string;
  secret: string;
}): string => {
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.accountName)}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
};

/**
 * Generates a PNG data URL QR code for scanning with Google Authenticator.
 */
export const generateQrCodeDataUrl = async (otpauthUrl: string): Promise<string> => {
  return QRCode.toDataURL(otpauthUrl, {
    width: 240,
    margin: 2,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });
};

const getEncryptionKey = (): Buffer => {
  return crypto
    .createHash('sha256')
    .update(`clock-in:totp-secret-v1:${env.JWT_ACCESS_SECRET}`)
    .digest();
};

/**
 * Encrypts a TOTP secret using AES-256-GCM before storing in PostgreSQL or setup tokens.
 */
export const encryptTotpSecret = (secret: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
};

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret.
 */
export const decryptTotpSecret = (payload: string): string => {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted TOTP secret');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};
