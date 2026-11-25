/**
 * Centralized sensitive data redaction utilities for logs and persisted error records.
 * Prevents accidental leakage of passwords, JWTs, refresh tokens, DB credentials, and phone numbers.
 */

const PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // Authorization / Bearer headers and JWTs (header.payload.signature)
  {
    regex: /\bBearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  {
    regex: /\beyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\b/g,
    replacement: '[REDACTED_JWT]',
  },
  // Database connection URLs containing credentials
  {
    regex: /(postgres(?:ql)?:\/\/)([^:\s@]+):([^@\s]+)@/gi,
    replacement: '$1[REDACTED_USER]:[REDACTED_PASS]@',
  },
  // JSON-encoded sensitive fields
  {
    regex: /("(?:password|passwordHash|secret|token|accessToken|refreshToken|lookupToken|actionToken|authorization|cookie)"\s*:\s*")([^"]*)(")/gi,
    replacement: '$1[REDACTED]$3',
  },
  // Key-value sensitive fields (query strings, logs, env dumps)
  {
    regex: /\b(password|passwordHash|secret|token|accessToken|refreshToken|apiKey|authorization)\s*([=:])\s*([^\s&,;]+)/gi,
    replacement: '$1$2[REDACTED]',
  },
  // Argon2 hashes
  {
    regex: /\$argon2(?:id|i|d)\$[^\s"']+/g,
    replacement: '[REDACTED_HASH]',
  },
  // International (+234...) and local Nigerian/10-15 digit phone numbers
  {
    regex: /(?:\+\d{1,3}[\s-]?)?\b0?[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    regex: /\+\d{10,15}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
];

/**
 * Redacts credentials, tokens, hashes, and phone numbers from arbitrary text.
 */
export function redactSensitiveText(input: string): string {
  let sanitized = input;
  for (const { regex, replacement } of PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}
