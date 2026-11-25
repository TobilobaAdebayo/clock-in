import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
  maskName,
} from '../../src/shared/utils/phone.js';

describe('Phone Normalization Utilities', () => {
  describe('Nigerian Local Numbers', () => {
    it('normalizes 11-digit local mobile number starting with 0', () => {
      expect(normalizePhoneNumber('08031234567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('09012345678')).toBe('+2349012345678');
      expect(normalizePhoneNumber('07089876543')).toBe('+2347089876543');
    });

    it('normalizes 10-digit number without leading 0', () => {
      expect(normalizePhoneNumber('8031234567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('9012345678')).toBe('+2349012345678');
    });

    it('handles Nigerian numbers with country code without plus', () => {
      expect(normalizePhoneNumber('2348031234567')).toBe('+2348031234567');
    });

    it('handles punctuation, spaces, dashes, and parentheses in numbers', () => {
      expect(normalizePhoneNumber('0803-123-4567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('0803 123 4567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('+234 (0) 803 123 4567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('(0803) 123 4567')).toBe('+2348031234567');
    });
  });

  describe('International Numbers', () => {
    it('normalizes valid E.164 numbers with plus', () => {
      expect(normalizePhoneNumber('+2348031234567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('+14155552671')).toBe('+14155552671');
      expect(normalizePhoneNumber('+447911123456')).toBe('+447911123456');
    });

    it('handles international numbers with spaces and dashes', () => {
      expect(normalizePhoneNumber('+1 (415) 555-2671')).toBe('+14155552671');
      expect(normalizePhoneNumber('+44 7911 123456')).toBe('+447911123456');
    });
  });

  describe('Invalid Inputs', () => {
    it('throws error for empty or whitespace-only inputs', () => {
      expect(() => normalizePhoneNumber('')).toThrow();
      expect(() => normalizePhoneNumber('   ')).toThrow();
    });

    it('throws error for numbers with too few digits', () => {
      expect(() => normalizePhoneNumber('12345')).toThrow();
      expect(() => normalizePhoneNumber('0803')).toThrow();
    });

    it('throws error for non-digit inputs', () => {
      expect(() => normalizePhoneNumber('not-a-number')).toThrow();
      expect(() => normalizePhoneNumber('abc@xyz.com')).toThrow();
    });
  });

  describe('Validation & Masking', () => {
    it('validates phone numbers correctly', () => {
      expect(isValidPhoneNumber('08031234567')).toBe(true);
      expect(isValidPhoneNumber('+2348031234567')).toBe(true);
      expect(isValidPhoneNumber('+14155552671')).toBe(true);
      expect(isValidPhoneNumber('abc')).toBe(false);
      expect(isValidPhoneNumber('1234')).toBe(false);
    });

    it('masks phone numbers to protect visitor privacy', () => {
      const masked = maskPhoneNumber('08031234567');
      expect(masked.startsWith('+23480')).toBe(true);
      expect(masked.endsWith('567')).toBe(true);
      expect(masked.includes('****')).toBe(true);
    });

    it('masks visitor names correctly', () => {
      expect(maskName('John Doe')).toBe('J*** D**');
      expect(maskName('Alexander Hamilton')).toBe('A******** H*******');
      expect(maskName('Ade')).toBe('A**');
    });
  });
});
