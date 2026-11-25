import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/db/prisma.js';
import { tokenService } from '../../src/modules/auth/token.service.js';
import { visitorsRepository } from '../../src/modules/visitors/visitors.repository.js';
import { attendanceRepository } from '../../src/modules/attendance/attendance.repository.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { auditRepository } from '../../src/modules/audit/audit.repository.js';
import { reportsRepository } from '../../src/modules/reports/reports.repository.js';

/**
 * Milestone 8 UAT Real-World Scenario Verification:
 *  1. New visitor registration & auto check-in
 *  2. Returning visitor privacy-safe lookup, confirmation & check-out
 *  3. Forgotten check-out -> Receptionist sees active session & exports daily Excel report
 *  4. Receptionist blocked (403) from correcting forgotten check-out
 *  5. Super Admin corrects forgotten check-out with mandatory reason -> audit log recorded
 */
describe('M8 UAT Real-World End-to-End Scenarios', () => {
  const app = createApp();

  const receptionist = {
    id: 'uat-receptionist-1',
    fullName: 'Grace FrontDesk',
    email: 'grace@clockin.workspace',
    passwordHash: 'hash',
    role: Role.RECEPTIONIST,
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const superAdmin = {
    id: 'uat-admin-1',
    fullName: 'Daniel Operations',
    email: 'daniel@clockin.workspace',
    passwordHash: 'hash',
    role: Role.SUPER_ADMIN,
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let receptionistToken: string;
  let adminToken: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(prisma);
      return cb;
    });

    vi.spyOn(staffRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === receptionist.id) return receptionist;
      if (id === superAdmin.id) return superAdmin;
      return null;
    });

    receptionistToken = tokenService.generateAccessToken({
      staffId: receptionist.id,
      email: receptionist.email,
      role: receptionist.role,
      fullName: receptionist.fullName,
    });

    adminToken = tokenService.generateAccessToken({
      staffId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      fullName: superAdmin.fullName,
    });
  });

  it('executes full UAT lifecycle: new visitor -> returning lookup/confirm/check-out -> forgotten check-out -> correction -> audit -> export', async () => {
    const checkInTime = new Date('2026-11-24T08:30:00.000Z');
    const visitorRecord = {
      id: 'uat-visitor-1',
      fullName: 'Ngozi Eze',
      phoneNumber: '+2348035551234',
      createdAt: checkInTime,
      updatedAt: checkInTime,
    };

    const sessions: any[] = [];
    const auditLogs: any[] = [];

    // Stateful repository mocks simulating real DB behavior across the scenario
    let visitorExists = false;
    vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockImplementation(async () =>
      visitorExists ? visitorRecord : null,
    );
    vi.spyOn(visitorsRepository, 'create').mockImplementation(async () => {
      visitorExists = true;
      return visitorRecord;
    });

    vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockImplementation(async (vid) =>
      sessions.find((s) => s.visitorId === vid && s.checkOut === null) || null,
    );
    vi.spyOn(attendanceRepository, 'create').mockImplementation(async (vid) => {
      const session = {
        id: `uat-att-${sessions.length + 1}`,
        visitorId: vid,
        checkIn: new Date(checkInTime.getTime() + sessions.length * 3600_000),
        checkOut: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessions.push(session);
      return session;
    });
    vi.spyOn(attendanceRepository, 'closeSession').mockImplementation(async (id, outTime) => {
      const session = sessions.find((s) => s.id === id);
      session.checkOut = outTime;
      return session;
    });
    vi.spyOn(attendanceRepository, 'findById').mockImplementation(async (id) => {
      const found = sessions.find((s) => s.id === id);
      return found ? { ...found } : null;
    });
    vi.spyOn(attendanceRepository, 'findActiveSessions').mockImplementation(async () =>
      sessions
        .filter((s) => s.checkOut === null)
        .map((s) => ({ ...s, visitor: visitorRecord })),
    );
    vi.spyOn(attendanceRepository, 'updateAttendance').mockImplementation(async (id, data) => {
      const session = sessions.find((s) => s.id === id);
      if (data.checkIn) session.checkIn = data.checkIn;
      if (data.checkOut !== undefined) session.checkOut = data.checkOut;
      return { ...session };
    });
    vi.spyOn(auditRepository, 'create').mockImplementation(async (data) => {
      const log = { id: `audit-${auditLogs.length + 1}`, ...data, createdAt: new Date() };
      auditLogs.push(log);
      return log as any;
    });
    vi.spyOn(reportsRepository, 'streamBatches').mockImplementation(
      async (_criteria, _batchSize, _maxRows, onBatch) => {
        const rows = sessions.map((s) => ({ ...s, visitor: visitorRecord }));
        await onBatch(rows);
        return rows.length;
      },
    );

    // 1. New visitor registration + auto check-in
    const regRes = await request(app)
      .post('/api/v1/public/visitors/register')
      .send({ fullName: 'Ngozi Eze', phoneNumber: '08035551234' });
    expect(regRes.status).toBe(201);
    expect(regRes.body.data.attendance.status).toBe('CHECKED_IN');

    // 2. Returning visitor lookup -> masked response, confirm -> actionToken -> check-out
    const lookupRes = await request(app)
      .post('/api/v1/public/visitors/lookup')
      .send({ phoneNumber: '08035551234' });
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.maskedName).toBe('N**** E**');
    expect(lookupRes.body.data.hasActiveSession).toBe(true);

    const confirmRes = await request(app)
      .post('/api/v1/public/visitors/confirm')
      .send({
        lookupToken: lookupRes.body.data.lookupToken,
        confirmationAnswer: 'Ngozi Eze',
      });
    expect(confirmRes.status).toBe(200);
    const { actionToken } = confirmRes.body.data;

    // Attempting duplicate check-in while active must fail with 409
    const dupCheckInRes = await request(app)
      .post('/api/v1/public/attendance/check-in')
      .send({ actionToken });
    expect(dupCheckInRes.status).toBe(409);

    // Check out cleanly
    const checkOutRes = await request(app)
      .post('/api/v1/public/attendance/check-out')
      .send({ actionToken });
    expect(checkOutRes.status).toBe(200);
    expect(checkOutRes.body.data.status).toBe('CHECKED_OUT');

    // 3. Visitor returns later and forgets to check out
    const secondCheckInRes = await request(app)
      .post('/api/v1/public/attendance/check-in')
      .send({ actionToken });
    expect(secondCheckInRes.status).toBe(201);
    const forgottenSessionId = secondCheckInRes.body.data.attendanceId;

    // Receptionist views active visitors and sees the unclosed session
    const activeRes = await request(app)
      .get('/api/v1/attendance/active')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data).toHaveLength(1);
    expect(activeRes.body.data[0].id).toBe(forgottenSessionId);

    // 4. Receptionist attempts to correct the forgotten check-out -> 403 Forbidden
    const forbiddenCorrectRes = await request(app)
      .patch(`/api/v1/attendance/${forgottenSessionId}/correct`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        checkOut: '2026-11-24T17:00:00.000Z',
        reason: 'Visitor forgot to sign out at desk',
      });
    expect(forbiddenCorrectRes.status).toBe(403);

    // 5. Super Admin corrects forgotten check-out -> 200 + Audit Log captured
    const adminCorrectRes = await request(app)
      .patch(`/api/v1/attendance/${forgottenSessionId}/correct`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        checkOut: '2026-11-24T17:00:00.000Z',
        reason: 'Visitor confirmed departure at 6:00 PM WAT via reception desk',
      });
    expect(adminCorrectRes.status).toBe(200);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('ATTENDANCE_CORRECTION');
    expect(auditLogs[0].actorId).toBe(superAdmin.id);
    expect(auditLogs[0].oldValues.checkOut).toBeNull();
    expect(auditLogs[0].newValues.checkOut).toBe('2026-11-24T17:00:00.000Z');

    // 6. Receptionist exports Daily Excel Report (.xlsx)
    const exportRes = await request(app)
      .get('/api/v1/reports/export?type=DAILY&date=2026-11-24')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(exportRes.headers['content-disposition']).toContain('attendance_daily_2026-11-24.xlsx');
  });
});
