import { describe, it, expect } from 'vitest';
import { redactSensitiveText } from '../../src/shared/utils/redact.js';

describe('Sensitive Data Redaction Utility', () => {
  it('redacts key-value passwords, secrets, and tokens', () => {
    const input = 'Auth failed for password=MySecret123&token=abc987&secret=xyz456';
    const output = redactSensitiveText(input);

    expect(output).not.toContain('MySecret123');
    expect(output).not.toContain('abc987');
    expect(output).not.toContain('xyz456');
    expect(output).toContain('password=[REDACTED]');
    expect(output).toContain('token=[REDACTED]');
    expect(output).toContain('secret=[REDACTED]');
  });

  it('redacts JSON-encoded sensitive fields', () => {
    const input = '{"email":"admin@test.com","password":"PlainPassword!","refreshToken":"ref-tok-123"}';
    const output = redactSensitiveText(input);

    expect(output).not.toContain('PlainPassword!');
    expect(output).not.toContain('ref-tok-123');
    expect(output).toContain('"password":"[REDACTED]"');
    expect(output).toContain('"refreshToken":"[REDACTED]"');
  });

  it('redacts Bearer JWT tokens and standalone JWTs', () => {
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiMTIzIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const input = `Header Authorization: Bearer ${fakeJwt} failed`;
    const output = redactSensitiveText(input);

    expect(output).not.toContain(fakeJwt);
    expect(output).toContain('[REDACTED_TOKEN]');
  });

  it('redacts PostgreSQL connection strings with credentials', () => {
    const input = 'P1000: Authentication failed against postgresql://postgres:SuperDbPass99@db.example.com:5432/clock_in';
    const output = redactSensitiveText(input);

    expect(output).not.toContain('SuperDbPass99');
    expect(output).toContain('postgresql://[REDACTED_USER]:[REDACTED_PASS]@db.example.com:5432/clock_in');
  });

  it('redacts Argon2id password hashes', () => {
    const hash = '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG';
    const output = redactSensitiveText(`Invalid hash: ${hash}`);

    expect(output).not.toContain('$argon2id$');
    expect(output).toContain('[REDACTED_HASH]');
  });

  it('redacts Nigerian local and international E.164 phone numbers', () => {
    const input = 'Lookup error for +2348012345678 and local 08123456789';
    const output = redactSensitiveText(input);

    expect(output).not.toContain('+2348012345678');
    expect(output).not.toContain('08123456789');
    expect(output).toContain('[REDACTED_PHONE]');
  });
});
