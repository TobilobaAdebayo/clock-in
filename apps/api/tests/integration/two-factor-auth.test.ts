import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Role, Staff } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { sessionRepository } from '../../src/modules/auth/session.repository.js';
import { auditService } from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/db/prisma.js';
import { hashPassword } from '../../src/shared/utils/crypto.js';
import {
  generateTotpSecret,
  generateTotpCode,
  encryptTotpSecret,
} from '../../src/shared/utils/totp.js';

describe('Google Authenticator (TOTP) 2FA Authentication & Management', () => {
  const app = createApp();
  let testIpCounter = 20;
  let testIp = '10.0.1.20';

  const staffStore = new Map<string, Staff>();
  const auditRecords: Array<{ actorId: string; action: string; recordId: string }> = [];

  let receptionistUser: Staff;
  let adminUser: Staff;
  let adminPlainSecret: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    testIp = `10.0.1.${++testIpCounter}`;
    staffStore.clear();
    auditRecords.length = 0;

    const passHash = await hashPassword('SecurePass123!');
    adminPlainSecret = generateTotpSecret();

    receptionistUser = {
      id: 'staff-recep-totp',
      fullName: 'Grace Receptionist',
      email: 'grace@clockin.workspace',
      passwordHash: passHash,
      role: Role.RECEPTIONIST,
      isActive: true,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    adminUser = {
      id: 'staff-admin-totp',
      fullName: 'Hub Super Admin',
      email: 'admin@clockin.workspace',
      passwordHash: passHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      twoFactorEnabled: true,
      twoFactorSecret: encryptTotpSecret(adminPlainSecret),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    staffStore.set(receptionistUser.id, receptionistUser);
    staffStore.set(adminUser.id, adminUser);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(prisma));

    vi.spyOn(staffRepository, 'findByEmail').mockImplementation(async (email) => {
      const normalized = email.toLowerCase().trim();
      return Array.from(staffStore.values()).find((s) => s.email === normalized) || null;
    });

    vi.spyOn(staffRepository, 'findById').mockImplementation(async (id) => {
      return staffStore.get(id) || null;
    });

    vi.spyOn(staffRepository, 'findManyPaginated').mockImplementation(async () => ({
      staff: Array.from(staffStore.values()),
      total: staffStore.size,
    }));

    vi.spyOn(staffRepository, 'update').mockImplementation(async (id, data) => {
      const existing = staffStore.get(id)!;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      staffStore.set(id, updated);
      return updated;
    });

    vi.spyOn(sessionRepository, 'createSession').mockImplementation(async (data) => ({
      id: 'session-totp-1',
      staffId: data.staffId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    }));

    vi.spyOn(auditService, 'record').mockImplementation(async (entry) => {
      auditRecords.push({
        actorId: entry.actorId,
        action: entry.action,
        recordId: entry.recordId,
      });
      return {
        id: 'audit-totp-1',
        actorId: entry.actorId,
        action: entry.action,
        recordType: entry.recordType,
        recordId: entry.recordId,
        oldValues: (entry.oldValues ?? null) as any,
        newValues: (entry.newValues ?? null) as any,
        createdAt: new Date(),
      };
    });
  });

  it('allows immediate login when Google Authenticator 2FA is disabled', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', testIp)
      .send({
        email: 'grace@clockin.workspace',
        password: 'SecurePass123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.requiresTwoFactor).toBe(false);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.staff.twoFactorEnabled).toBe(false);
  });

  it('requires a valid 6-digit Google Authenticator code when 2FA is enabled', async () => {
    // 1. Password login returns challengeToken without accessToken or refresh cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', testIp)
      .send({
        email: 'admin@clockin.workspace',
        password: 'SecurePass123!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.requiresTwoFactor).toBe(true);
    expect(loginRes.body.data.challengeToken).toBeDefined();
    expect(loginRes.body.data.accessToken).toBeUndefined();
    expect(loginRes.headers['set-cookie']).toBeUndefined();

    const { challengeToken } = loginRes.body.data;
    const liveCode = generateTotpCode(adminPlainSecret);

    // 2. Wrong 6-digit code is rejected
    const wrongCodeRes = await request(app)
      .post('/api/v1/auth/2fa/verify-login')
      .set('X-Forwarded-For', testIp)
      .send({
        challengeToken,
        code: liveCode === '000000' ? '111111' : '000000',
      });
    expect(wrongCodeRes.status).toBe(401);

    // 3. Valid Google Authenticator code completes login and sets HttpOnly cookie
    const verifyRes = await request(app)
      .post('/api/v1/auth/2fa/verify-login')
      .set('X-Forwarded-For', testIp)
      .send({
        challengeToken,
        code: liveCode,
      });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeDefined();
    expect(verifyRes.body.data.staff.twoFactorEnabled).toBe(true);
    expect(verifyRes.headers['set-cookie']).toBeDefined();
  });

  it('allows Receptionist to set up Google Authenticator via QR/key, sign in with TOTP, and turn it off with password', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', testIp)
      .send({
        email: 'grace@clockin.workspace',
        password: 'SecurePass123!',
      });
    const token = loginRes.body.data.accessToken;

    // 1. Start setup -> returns QR data URL, manual key, and setupToken
    const setupRes = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${token}`);

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(setupRes.body.data.manualEntryKey).toBeTruthy();
    expect(setupRes.body.data.setupToken).toBeTruthy();

    // 2. Confirm setup with live TOTP code generated from manualEntryKey
    const secretFromKey = setupRes.body.data.manualEntryKey.replace(/\s+/g, '');
    const code = generateTotpCode(secretFromKey);

    const enableRes = await request(app)
      .post('/api/v1/auth/2fa/enable')
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${token}`)
      .send({
        setupToken: setupRes.body.data.setupToken,
        code,
      });

    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.twoFactorEnabled).toBe(true);
    expect(auditRecords.some((a) => a.action === 'ENABLE_2FA')).toBe(true);

    // 3. Wrong password cannot disable 2FA
    const badDisable = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'WrongPassword!' });
    expect(badDisable.status).toBe(401);

    // 4. Correct password disables 2FA and clears stored secret
    const disableRes = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'SecurePass123!' });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.twoFactorEnabled).toBe(false);
    expect(staffStore.get(receptionistUser.id)?.twoFactorSecret).toBeNull();
    expect(auditRecords.some((a) => a.action === 'DISABLE_2FA')).toBe(true);
  });

  it('never leaks twoFactorSecret in staff listings and lets Super Admin reset another staff member 2FA', async () => {
    const recepSecret = generateTotpSecret();
    staffStore.set(receptionistUser.id, {
      ...receptionistUser,
      twoFactorEnabled: true,
      twoFactorSecret: encryptTotpSecret(recepSecret),
    });

    // Sign in as Super Admin with Google Authenticator code
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', testIp)
      .send({
        email: 'admin@clockin.workspace',
        password: 'SecurePass123!',
      });
    const adminVerify = await request(app)
      .post('/api/v1/auth/2fa/verify-login')
      .set('X-Forwarded-For', testIp)
      .send({
        challengeToken: adminLogin.body.data.challengeToken,
        code: generateTotpCode(adminPlainSecret),
      });
    const adminToken = adminVerify.body.data.accessToken;

    // Staff list must never expose twoFactorSecret or passwordHash
    const listRes = await request(app)
      .get('/api/v1/staff')
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    for (const s of listRes.body.data) {
      expect(s.passwordHash).toBeUndefined();
      expect(s.twoFactorSecret).toBeUndefined();
    }

    // Super Admin resets receptionist's 2FA
    const resetRes = await request(app)
      .post(`/api/v1/staff/${receptionistUser.id}/reset-2fa`)
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.twoFactorEnabled).toBe(false);
    expect(resetRes.body.data.twoFactorSecret).toBeUndefined();
    expect(staffStore.get(receptionistUser.id)?.twoFactorSecret).toBeNull();
    expect(auditRecords.some((a) => a.action === 'RESET_STAFF_2FA')).toBe(true);

    // Receptionist signs in without 2FA now, and is blocked (403) from resetting Super Admin's 2FA
    const recepLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', testIp)
      .send({
        email: 'grace@clockin.workspace',
        password: 'SecurePass123!',
      });
    expect(recepLogin.body.data.requiresTwoFactor).toBe(false);

    const forbiddenReset = await request(app)
      .post(`/api/v1/staff/${adminUser.id}/reset-2fa`)
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${recepLogin.body.data.accessToken}`);
    expect(forbiddenReset.status).toBe(403);
  });
});
