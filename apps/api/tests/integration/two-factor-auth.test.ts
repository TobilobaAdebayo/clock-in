import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Role, Staff, TwoFactorChallenge, TwoFactorPurpose } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { sessionRepository } from '../../src/modules/auth/session.repository.js';
import { twoFactorRepository } from '../../src/modules/auth/two-factor.repository.js';
import { auditService } from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/db/prisma.js';
import { hashPassword } from '../../src/shared/utils/crypto.js';
import { mailerService } from '../../src/shared/utils/mailer.js';

describe('Email 2FA Authentication & Management', () => {
  const app = createApp();
  let testIpCounter = 1;
  let testIp = '10.0.0.1';

  const staffStore = new Map<string, Staff>();
  const challengeStore = new Map<string, TwoFactorChallenge>();
  const sentEmails: Array<{ to: string; code: string; purpose: 'LOGIN' | 'ENABLE' }> = [];
  const auditRecords: Array<{ actorId: string; action: string; recordId: string }> = [];

  let receptionistUser: Staff;
  let adminUser: Staff;

  beforeEach(async () => {
    vi.restoreAllMocks();
    testIp = `10.0.0.${++testIpCounter}`;
    staffStore.clear();
    challengeStore.clear();
    sentEmails.length = 0;
    auditRecords.length = 0;

    const passHash = await hashPassword('SecurePass123!');

    receptionistUser = {
      id: 'staff-recep-2fa',
      fullName: 'Grace Receptionist',
      email: 'grace@clockin.workspace',
      passwordHash: passHash,
      role: Role.RECEPTIONIST,
      isActive: true,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    adminUser = {
      id: 'staff-admin-2fa',
      fullName: 'Hub Super Admin',
      email: 'admin@clockin.workspace',
      passwordHash: passHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      twoFactorEnabled: true,
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

    vi.spyOn(staffRepository, 'update').mockImplementation(async (id, data) => {
      const existing = staffStore.get(id)!;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      staffStore.set(id, updated);
      return updated;
    });

    vi.spyOn(sessionRepository, 'createSession').mockImplementation(async (data) => ({
      id: 'session-2fa-1',
      staffId: data.staffId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    }));

    vi.spyOn(twoFactorRepository, 'invalidatePendingForStaff').mockImplementation(
      async (staffId, purpose) => {
        for (const [key, ch] of challengeStore.entries()) {
          if (ch.staffId === staffId && (!purpose || ch.purpose === purpose) && !ch.consumedAt) {
            challengeStore.set(key, { ...ch, consumedAt: new Date() });
          }
        }
      },
    );

    vi.spyOn(twoFactorRepository, 'createChallenge').mockImplementation(async (data) => {
      const record: TwoFactorChallenge = {
        id: data.id,
        staffId: data.staffId,
        purpose: data.purpose,
        codeHash: data.codeHash,
        attempts: 0,
        expiresAt: data.expiresAt,
        consumedAt: null,
        createdAt: new Date(),
      };
      challengeStore.set(record.id, record);
      return record;
    });

    vi.spyOn(twoFactorRepository, 'findById').mockImplementation(async (id) => {
      return challengeStore.get(id) || null;
    });

    vi.spyOn(twoFactorRepository, 'incrementAttempts').mockImplementation(async (id) => {
      const existing = challengeStore.get(id)!;
      const updated = { ...existing, attempts: existing.attempts + 1 };
      challengeStore.set(id, updated);
      return updated;
    });

    vi.spyOn(twoFactorRepository, 'markConsumed').mockImplementation(async (id) => {
      const existing = challengeStore.get(id)!;
      const updated = { ...existing, consumedAt: new Date() };
      challengeStore.set(id, updated);
      return updated;
    });

    vi.spyOn(auditService, 'record').mockImplementation(async (entry) => {
      auditRecords.push({
        actorId: entry.actorId,
        action: entry.action,
        recordId: entry.recordId,
      });
      return {
        id: 'audit-1',
        actorId: entry.actorId,
        action: entry.action,
        recordType: entry.recordType,
        recordId: entry.recordId,
        oldValues: (entry.oldValues ?? null) as any,
        newValues: (entry.newValues ?? null) as any,
        createdAt: new Date(),
      };
    });

    // Capture emailed codes without hitting a real SMTP server
    vi.spyOn(mailerService, 'sendTwoFactorCodeEmail').mockImplementation(async (params) => {
      sentEmails.push({ to: params.to, code: params.code, purpose: params.purpose });
      return { deliveredVia: 'console' };
    });
  });

  it('allows immediate login when 2FA is disabled (optional per account)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'grace@clockin.workspace',
      password: 'SecurePass123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.requiresTwoFactor).toBe(false);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.staff.twoFactorEnabled).toBe(false);
    expect(sentEmails).toHaveLength(0);
  });

  it('requires 6-digit email verification code when 2FA is enabled and issues tokens only after verification', async () => {
    // 1. Password login returns challenge without tokens or cookies
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@clockin.workspace',
      password: 'SecurePass123!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.requiresTwoFactor).toBe(true);
    expect(loginRes.body.data.challengeToken).toBeDefined();
    expect(loginRes.body.data.accessToken).toBeUndefined();
    expect(loginRes.headers['set-cookie']).toBeUndefined();
    expect(loginRes.body.data.maskedEmail).toBe('ad***@clockin.workspace');
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].purpose).toBe(TwoFactorPurpose.LOGIN);

    const { challengeToken } = loginRes.body.data;
    const validCode = sentEmails[0].code;

    // 2. Wrong code is rejected
    const badCodeRes = await request(app).post('/api/v1/auth/2fa/verify-login').send({
      challengeToken,
      code: validCode === '000000' ? '111111' : '000000',
    });
    expect(badCodeRes.status).toBe(401);

    // 3. Valid 6-digit code completes sign-in and sets HttpOnly refresh cookie
    const verifyRes = await request(app).post('/api/v1/auth/2fa/verify-login').send({
      challengeToken,
      code: validCode,
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeDefined();
    expect(verifyRes.body.data.staff.email).toBe('admin@clockin.workspace');
    expect(verifyRes.body.data.staff.twoFactorEnabled).toBe(true);
    expect(verifyRes.headers['set-cookie']).toBeDefined();

    // 4. Replaying the same code is rejected
    const replayRes = await request(app).post('/api/v1/auth/2fa/verify-login').send({
      challengeToken,
      code: validCode,
    });
    expect(replayRes.status).toBe(401);
  });

  it('invalidates the previous login code when resending a new code', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@clockin.workspace',
      password: 'SecurePass123!',
    });
    const firstToken = loginRes.body.data.challengeToken;
    const firstCode = sentEmails[0].code;

    const resendRes = await request(app).post('/api/v1/auth/2fa/resend-login').send({
      challengeToken: firstToken,
    });
    expect(resendRes.status).toBe(200);
    expect(sentEmails).toHaveLength(2);

    const secondToken = resendRes.body.data.challengeToken;
    const secondCode = sentEmails[1].code;

    // Old code no longer works
    const oldAttempt = await request(app).post('/api/v1/auth/2fa/verify-login').send({
      challengeToken: firstToken,
      code: firstCode,
    });
    expect(oldAttempt.status).toBe(401);

    // New code succeeds
    const newAttempt = await request(app).post('/api/v1/auth/2fa/verify-login').send({
      challengeToken: secondToken,
      code: secondCode,
    });
    expect(newAttempt.status).toBe(200);
    expect(newAttempt.body.data.accessToken).toBeDefined();
  });

  it('allows a Receptionist to enable and disable Email 2FA on their own account', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'grace@clockin.workspace',
      password: 'SecurePass123!',
    });
    const token = loginRes.body.data.accessToken;

    // Start enable
    const startRes = await request(app)
      .post('/api/v1/auth/2fa/enable/start')
      .set('Authorization', `Bearer ${token}`);
    expect(startRes.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].purpose).toBe(TwoFactorPurpose.ENABLE);

    // Confirm enable with emailed code
    const confirmRes = await request(app)
      .post('/api/v1/auth/2fa/enable/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        challengeToken: startRes.body.data.challengeToken,
        code: sentEmails[0].code,
      });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.twoFactorEnabled).toBe(true);
    expect(auditRecords.some((a) => a.action === 'ENABLE_2FA')).toBe(true);

    // Wrong password cannot disable 2FA
    const badDisable = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'WrongPassword!' });
    expect(badDisable.status).toBe(401);

    // Correct password disables 2FA
    const disableRes = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'SecurePass123!' });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.twoFactorEnabled).toBe(false);
    expect(auditRecords.some((a) => a.action === 'DISABLE_2FA')).toBe(true);
  });

  it('allows Super Admin to reset 2FA on a staff account and blocks Receptionist from resetting others', async () => {
    // Enable 2FA on receptionist first
    staffStore.set(receptionistUser.id, { ...receptionistUser, twoFactorEnabled: true });

    // Sign in as Super Admin (through 2FA)
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
        code: sentEmails[0].code,
      });
    const adminToken = adminVerify.body.data.accessToken;

    // Super Admin resets receptionist 2FA
    const resetRes = await request(app)
      .post(`/api/v1/staff/${receptionistUser.id}/reset-2fa`)
      .set('X-Forwarded-For', testIp)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.twoFactorEnabled).toBe(false);
    expect(auditRecords.some((a) => a.action === 'RESET_STAFF_2FA')).toBe(true);

    // Receptionist signs in now (2FA was reset) and tries to reset admin's 2FA -> 403
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
