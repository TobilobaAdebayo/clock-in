import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
  signLookupToken,
  verifyLookupToken,
} from '../../src/shared/utils/crypto.js';

describe('Crypto & Auth Utilities', () => {
  describe('Argon2id Password Hashing', () => {
    it('hashes and successfully verifies a password', async () => {
      const password = 'SuperSecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const password = 'CorrectPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword!', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Token Generation & Hashing', () => {
    it('generates random hex tokens with expected byte length', () => {
      const token32 = generateToken(32);
      expect(token32).toHaveLength(64); // 32 bytes in hex = 64 characters

      const token16 = generateToken(16);
      expect(token16).toHaveLength(32);
    });

    it('consistently produces SHA-256 hashes of tokens', () => {
      const token = 'my-sample-token-string';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 is 64 hex characters
    });
  });

  describe('Lookup Token Signing & Verification', () => {
    const secret = 'super-secret-key-for-lookup-tokens-12345';

    it('signs and verifies a valid lookup token', () => {
      const payload = { visitorId: '123-abc', phoneNumber: '+2348031234567' };
      const token = signLookupToken(payload, secret, 60);

      const verified = verifyLookupToken<typeof payload>(token, secret);
      expect(verified).not.toBeNull();
      expect(verified?.visitorId).toBe('123-abc');
      expect(verified?.phoneNumber).toBe('+2348031234567');
    });

    it('rejects token with wrong secret or tampered payload', () => {
      const payload = { visitorId: '123-abc' };
      const token = signLookupToken(payload, secret, 60);

      const withWrongSecret = verifyLookupToken(token, 'wrong-secret');
      expect(withWrongSecret).toBeNull();

      const tampered = token.slice(0, -3) + 'xyz';
      const withTamperedToken = verifyLookupToken(tampered, secret);
      expect(withTamperedToken).toBeNull();
    });

    it('rejects expired tokens', () => {
      const payload = { visitorId: '123-abc' };
      // Expired 5 seconds ago
      const token = signLookupToken(payload, secret, -5);

      const verified = verifyLookupToken(token, secret);
      expect(verified).toBeNull();
    });
  });
});
