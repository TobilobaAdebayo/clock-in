/**
 * Phone number normalization and masking utilities.
 * Defaults to Nigeria (+234) region when local format is provided.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

/**
 * Normalizes a phone number to E.164 format.
 * Examples:
 *   "08031234567" -> "+2348031234567"
 *   "8031234567"  -> "+2348031234567"
 *   "+234 803 123 4567" -> "+2348031234567"
 *   "2348031234567" -> "+2348031234567"
 *   "+1 (415) 555-2671" -> "+14155552671"
 */
export function normalizePhoneNumber(raw: string, defaultCountryPrefix = '+234'): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Phone number must be a non-empty string');
  }

  // Strip all non-digit characters except leading plus
  let cleaned = raw.trim().replace(/[\s\(\)\-\.]/g, '');

  // Handle "+234(0)..." format where zero is enclosed in parentheses
  cleaned = cleaned.replace(/^\+2340/, '+234');

  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digitsOnly)) {
      throw new Error(`Invalid international phone number: ${raw}`);
    }
    return `+${digitsOnly}`;
  }

  // Remove any non-digits
  cleaned = cleaned.replace(/\D/g, '');

  if (!cleaned) {
    throw new Error('Phone number contains no valid digits');
  }

  // If starts with 234 and has standard Nigerian mobile length (13 digits: 234 + 10 digits)
  if (cleaned.startsWith('234')) {
    if (cleaned.length === 13) {
      return `+${cleaned}`;
    }
  }

  // If starts with 0 and has 11 digits (e.g. 08031234567)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `${defaultCountryPrefix}${cleaned.slice(1)}`;
  }

  // If 10 digits without leading 0 (e.g. 8031234567)
  if (cleaned.length === 10) {
    return `${defaultCountryPrefix}${cleaned}`;
  }

  // If already full international number without plus (e.g. 14155552671)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }

  throw new Error(`Cannot normalize invalid phone number: ${raw}`);
}

/**
 * Validates whether a phone number can be normalized to E.164
 */
export function isValidPhoneNumber(raw: string): boolean {
  try {
    normalizePhoneNumber(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Masks a phone number to protect privacy on public screens.
 * Example: "+2348031234567" -> "+234803****567"
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return '';
  const normalized = isValidPhoneNumber(phoneNumber) ? normalizePhoneNumber(phoneNumber) : phoneNumber;
  if (normalized.length <= 7) {
    return '***' + normalized.slice(-3);
  }
  const prefix = normalized.slice(0, 6);
  const suffix = normalized.slice(-3);
  const maskLength = normalized.length - prefix.length - suffix.length;
  return `${prefix}${'*'.repeat(Math.max(maskLength, 3))}${suffix}`;
}

/**
 * Masks a visitor's name for returning visitor hints.
 * Example: "Johnathan Doe" -> "J*** D**"
 */
export function maskName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 1) return part;
      return part[0] + '*'.repeat(Math.max(part.length - 1, 2));
    })
    .join(' ');
}
