import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Attendance, Role, Staff, Visitor } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { visitorsRepository } from '../../src/modules/visitors/visitors.repository.js';
import { attendanceRepository } from '../../src/modules/attendance/attendance.repository.js';
import { auditService } from '../../src/modules/audit/audit.service.js';
import { tokenService } from '../../src/modules/auth/token.service.js';
import { prisma } from '../../src/shared/db/prisma.js';

describe('SECURITY Role RBAC & Front-Desk Check-In/Out', () => {
  const app = createApp();

  const securityStaff: Staff = {
    id: 'staff-security-1',
    fullName: 'Gate Security Officer',
    email: 'security@clockin.workspace',
    passwordHash: 'hash',
    role: Role.SECURITY,
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let securityToken: string;
  const visitors: Visitor[] = [];
  const attendances: Attendance[] = [];
  const auditActions: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    visitors.length = 0;
    attendances.length = 0;
    auditActions.length = 0;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(prisma));
    vi.spyOn(staffRepository, 'findById').mockResolvedValue(securityStaff);

    vi.spyOn(visitorsRepository, 'findByFullName').mockImplementation(async (name) =>
      visitors.filter((v) => v.fullName.toLowerCase() === name.trim().toLowerCase()),
    );
    vi.spyOn(visitorsRepository, 'create').mockImplementation(async (data) => {
      const record: Visitor = {
        id: `vis-sec-${visitors.length + 1}`,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      visitors.push(record);
      return record;
    });

    vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockImplementation(async (vid) =>
      attendances.find((a) => a.visitorId === vid && a.checkOut === null) || null,
    );
    vi.spyOn(attendanceRepository, 'create').mockImplementation(async (vid, _tx, hostName) => {
      const record: Attendance = {
        id: `att-sec-${attendances.length + 1}`,
        visitorId: vid,
        hostName: hostName ?? null,
        checkIn: new Date(),
        checkOut: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      attendances.push(record);
      return record;
    });
    vi.spyOn(attendanceRepository, 'findById').mockImplementation(async (id) =>
      attendances.find((a) => a.id === id) || null,
    );
    vi.spyOn(attendanceRepository, 'closeSession').mockImplementation(async (id, outTime) => {
      const target = attendances.find((a) => a.id === id)!;
      target.checkOut = outTime ?? new Date();
      return target;
    });
    vi.spyOn(attendanceRepository, 'findActiveSessions').mockImplementation(async () =>
      attendances
        .filter((a) => a.checkOut === null)
        .map((a) => {
          const v = visitors.find((x) => x.id === a.visitorId)!;
          return {
            ...a,
            visitor: {
              id: v.id,
              fullName: v.fullName,
              phoneNumber: '+2348090001111',
            },
          };
        }),
    );

    vi.spyOn(auditService, 'record').mockImplementation(async (entry) => {
      auditActions.push(entry.action);
      return {
        id: `audit-${auditActions.length}`,
        actorId: entry.actorId,
        action: entry.action,
        recordType: entry.recordType,
        recordId: entry.recordId,
        oldValues: (entry.oldValues ?? null) as any,
        newValues: (entry.newValues ?? null) as any,
        createdAt: new Date(),
      };
    });

    securityToken = tokenService.generateAccessToken({
      staffId: securityStaff.id,
      email: securityStaff.email,
      role: Role.SECURITY,
      fullName: securityStaff.fullName,
    });
  });

  it('allows Security to sign in a visitor with full name and host (phone optional), hides phone numbers in active list, and allows 1-click sign out', async () => {
    // 0. Omitting who they are here to see is rejected with 400
    const missingHostRes = await request(app)
      .post('/api/v1/attendance/manual-check-in')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ fullName: 'Chief Guest' });
    expect(missingHostRes.status).toBe(400);

    // 1. Phone-optional sign-in (fullName + hostName required)
    const checkInRes = await request(app)
      .post('/api/v1/attendance/manual-check-in')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ fullName: 'Chief Guest', hostName: 'Operations Desk' });

    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.data.visitor.fullName).toBe('Chief Guest');
    expect(checkInRes.body.data.visitor.phoneNumber).toBeUndefined();
    expect(auditActions).toContain('SECURITY_CHECK_IN');

    const attendanceId = checkInRes.body.data.attendance.id;

    // 2. Active list returns visitor name without exposing phoneNumber
    const activeRes = await request(app)
      .get('/api/v1/attendance/active')
      .set('Authorization', `Bearer ${securityToken}`);

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data).toHaveLength(1);
    expect(activeRes.body.data[0].visitor.fullName).toBe('Chief Guest');
    expect(activeRes.body.data[0].visitor.phoneNumber).toBeUndefined();

    // 3. Security signs the visitor out
    const checkOutRes = await request(app)
      .post(`/api/v1/attendance/${attendanceId}/manual-check-out`)
      .set('Authorization', `Bearer ${securityToken}`);

    expect(checkOutRes.status).toBe(200);
    expect(checkOutRes.body.data.checkOut).toBeTruthy();
    expect(auditActions).toContain('SECURITY_CHECK_OUT');
  });

  it('strictly blocks Security (403) from Receptionist & Super Admin endpoints', async () => {
    const blockedEndpoints = [
      '/api/v1/dashboard/summary',
      '/api/v1/visitors',
      '/api/v1/attendance',
      '/api/v1/reports/export?type=DAILY&date=2026-11-26',
      '/api/v1/staff',
      '/api/v1/audit-logs',
    ];

    for (const endpoint of blockedEndpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(res.status, `Expected 403 for GET ${endpoint}`).toBe(403);
    }

    const patchSettingsRes = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ workspaceName: 'Hacked Hub' });
    expect(patchSettingsRes.status).toBe(403);
  });
});
