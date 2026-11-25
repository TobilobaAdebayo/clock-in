import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { sessionRepository } from '../../src/modules/auth/session.repository.js';
import { attendanceRepository } from '../../src/modules/attendance/attendance.repository.js';
import { auditRepository } from '../../src/modules/audit/audit.repository.js';
import { appErrorsRepository } from '../../src/modules/app-errors/app-errors.repository.js';
import { settingsRepository } from '../../src/modules/settings/settings.repository.js';
import { tokenService } from '../../src/modules/auth/token.service.js';
import { prisma } from '../../src/shared/db/prisma.js';
import { Role, ErrorStatus, ErrorSeverity } from '@prisma/client';

describe('Super Admin Tools (M6 Integration)', () => {
  const app = createApp();

  const mockAdmin = {
    id: 'admin-uuid-1',
    fullName: 'Chief Administrator',
    email: 'admin@clockin.workspace',
    passwordHash: 'argon2id$mockedhash',
    role: Role.SUPER_ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReceptionist = {
    id: 'receptionist-uuid-1',
    fullName: 'Front Desk Operator',
    email: 'receptionist@clockin.workspace',
    passwordHash: 'argon2id$mockedhash',
    role: Role.RECEPTIONIST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let adminToken: string;
  let receptionistToken: string;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock prisma.$transaction to pass through callback with mock prisma
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(prisma);
      }
      return Promise.all(cb);
    });

    vi.spyOn(staffRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === mockAdmin.id) return mockAdmin as any;
      if (id === mockReceptionist.id) return mockReceptionist as any;
      return null;
    });

    adminToken = tokenService.generateAccessToken({
      staffId: mockAdmin.id,
      email: mockAdmin.email,
      role: Role.SUPER_ADMIN,
      fullName: mockAdmin.fullName,
    });

    receptionistToken = tokenService.generateAccessToken({
      staffId: mockReceptionist.id,
      email: mockReceptionist.email,
      role: Role.RECEPTIONIST,
      fullName: mockReceptionist.fullName,
    });
  });

  describe('FR-16: Staff Management & Last Super Admin Protection', () => {
    it('allows Super Admin to list staff accounts with pagination', async () => {
      vi.spyOn(staffRepository, 'findManyPaginated').mockResolvedValue({
        staff: [mockAdmin, mockReceptionist] as any,
        total: 2,
      });

      const res = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).not.toHaveProperty('passwordHash');
    });

    it('creates a new receptionist and creates an audit log entry', async () => {
      vi.spyOn(staffRepository, 'findByEmail').mockResolvedValue(null);
      const createdStaff = {
        id: 'new-staff-id',
        fullName: 'New Receptionist',
        email: 'new@clockin.workspace',
        passwordHash: 'hashed',
        role: Role.RECEPTIONIST,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(staffRepository, 'create').mockResolvedValue(createdStaff as any);
      const auditSpy = vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'New Receptionist',
          email: 'new@clockin.workspace',
          password: 'Password123!',
          role: 'RECEPTIONIST',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe('New Receptionist');
      expect(res.body.data).not.toHaveProperty('passwordHash');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_STAFF',
          recordType: 'STAFF',
          recordId: 'new-staff-id',
        }),
        expect.anything(),
      );
    });

    it('rejects staff creation with duplicate email', async () => {
      vi.spyOn(staffRepository, 'findByEmail').mockResolvedValue(mockReceptionist as any);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Duplicate Staff',
          email: 'receptionist@clockin.workspace',
          password: 'Password123!',
          role: 'RECEPTIONIST',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already exists');
    });

    it('deactivates staff and revokes all active refresh sessions', async () => {
      vi.spyOn(staffRepository, 'findById').mockResolvedValue(mockReceptionist as any);
      vi.spyOn(staffRepository, 'update').mockResolvedValue({
        ...mockReceptionist,
        isActive: false,
      } as any);
      const revokeSpy = vi.spyOn(sessionRepository, 'revokeAllForStaff').mockResolvedValue({ count: 2 } as any);
      const auditSpy = vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post(`/api/v1/staff/${mockReceptionist.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(revokeSpy).toHaveBeenCalledWith(mockReceptionist.id, expect.anything());
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEACTIVATE_STAFF',
          recordId: mockReceptionist.id,
        }),
        expect.anything(),
      );
    });

    it('blocks deactivating or demoting the last active Super Admin', async () => {
      vi.spyOn(staffRepository, 'findById').mockResolvedValue(mockAdmin as any);
      vi.spyOn(staffRepository, 'countActiveSuperAdmins').mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/v1/staff/${mockAdmin.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cannot deactivate or demote the last active Super Admin');
    });
  });

  describe('FR-17: Attendance Correction with Mandatory Reason & Audit Trail', () => {
    const existingAttendance = {
      id: 'att-correct-uuid',
      visitorId: 'visitor-uuid-1',
      checkIn: new Date('2026-11-24T09:00:00Z'),
      checkOut: new Date('2026-11-24T17:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('successfully corrects attendance check-in/out and records audit log with old and new values', async () => {
      vi.spyOn(attendanceRepository, 'findById').mockResolvedValue(existingAttendance as any);
      const updatedMock = {
        ...existingAttendance,
        checkOut: new Date('2026-11-24T18:00:00Z'),
      };
      vi.spyOn(attendanceRepository, 'updateAttendance').mockResolvedValue(updatedMock as any);
      const auditSpy = vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .patch(`/api/v1/attendance/${existingAttendance.id}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkOut: '2026-11-24T18:00:00Z',
          reason: 'Visitor stayed 1 hour late for developer meetup presentation',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTENDANCE_CORRECTION',
          recordType: 'ATTENDANCE',
          recordId: existingAttendance.id,
          newValues: expect.objectContaining({
            reason: 'Visitor stayed 1 hour late for developer meetup presentation',
          }),
        }),
        expect.anything(),
      );
    });

    it('rejects attendance correction without mandatory reason', async () => {
      const res = await request(app)
        .patch(`/api/v1/attendance/${existingAttendance.id}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkOut: '2026-11-24T18:00:00Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects correction if check-out is before or equal to check-in', async () => {
      vi.spyOn(attendanceRepository, 'findById').mockResolvedValue(existingAttendance as any);

      const res = await request(app)
        .patch(`/api/v1/attendance/${existingAttendance.id}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkOut: '2026-11-24T08:00:00Z', // Before 09:00:00Z
          reason: 'Mistyped timestamp test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Check-out timestamp must be after check-in');
    });

    it('rejects opening a session if the visitor already has another active session', async () => {
      vi.spyOn(attendanceRepository, 'findById').mockResolvedValue(existingAttendance as any);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue({
        id: 'different-active-session',
        visitorId: existingAttendance.visitorId,
        checkIn: new Date(),
        checkOut: null,
      } as any);

      const res = await request(app)
        .patch(`/api/v1/attendance/${existingAttendance.id}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkOut: null, // Attempting to reopen
          reason: 'Forgot to keep visitor active',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already has another open active session');
    });
  });

  describe('FR-18: Audit Log Viewer', () => {
    it('returns paginated audit logs for Super Admin', async () => {
      vi.spyOn(auditRepository, 'findManyPaginated').mockResolvedValue({
        logs: [
          {
            id: 'audit-1',
            actorId: mockAdmin.id,
            action: 'ATTENDANCE_CORRECTION',
            recordType: 'ATTENDANCE',
            recordId: 'att-1',
            oldValues: {},
            newValues: {},
            createdAt: new Date(),
            actor: {
              id: mockAdmin.id,
              fullName: mockAdmin.fullName,
              email: mockAdmin.email,
              role: mockAdmin.role,
            },
          },
        ] as any,
        total: 1,
      });

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].action).toBe('ATTENDANCE_CORRECTION');
    });
  });

  describe('FR-19: Application Error Capture & Resolution', () => {
    it('lists app errors with status filter for Super Admin', async () => {
      vi.spyOn(appErrorsRepository, 'findManyPaginated').mockResolvedValue({
        errors: [
          {
            id: 'err-1',
            errorType: 'DatabaseConnectionTimeout',
            message: 'Connection pool timeout',
            severity: ErrorSeverity.HIGH,
            status: ErrorStatus.OPEN,
            stack: 'Error at ...',
            createdAt: new Date(),
            resolvedAt: null,
          },
        ] as any,
        total: 1,
      });

      const res = await request(app)
        .get('/api/v1/app-errors?status=OPEN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].errorType).toBe('DatabaseConnectionTimeout');
    });

    it('marks an application error as resolved', async () => {
      vi.spyOn(appErrorsRepository, 'findById').mockResolvedValue({
        id: 'err-1',
        status: ErrorStatus.OPEN,
      } as any);
      vi.spyOn(appErrorsRepository, 'updateStatus').mockResolvedValue({
        id: 'err-1',
        status: ErrorStatus.RESOLVED,
        resolvedAt: new Date(),
      } as any);

      const res = await request(app)
        .patch('/api/v1/app-errors/err-1/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
    });
  });

  describe('FR-20: System Settings & IANA Timezone Validation', () => {
    it('returns workspace settings for authenticated staff', async () => {
      vi.spyOn(settingsRepository, 'getAll').mockResolvedValue([
        { id: '1', key: 'workspace_name', value: 'Innovation Hub', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', key: 'workspace_timezone', value: 'Africa/Lagos', createdAt: new Date(), updatedAt: new Date() },
      ]);

      const res = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workspaceName).toBe('Innovation Hub');
      expect(res.body.data.workspaceTimezone).toBe('Africa/Lagos');
    });

    it('updates workspace settings and validates IANA timezone', async () => {
      vi.spyOn(settingsRepository, 'getAll').mockResolvedValue([]);
      vi.spyOn(settingsRepository, 'set').mockResolvedValue({} as any);
      const auditSpy = vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workspaceName: 'Lagos Tech Center',
          workspaceTimezone: 'UTC',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workspaceName).toBe('Lagos Tech Center');
      expect(res.body.data.workspaceTimezone).toBe('UTC');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_SETTINGS',
          recordType: 'SETTING',
        }),
        expect.anything(),
      );
    });

    it('rejects invalid IANA timezone identifier with 400', async () => {
      vi.spyOn(settingsRepository, 'getAll').mockResolvedValue([]);

      const res = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workspaceTimezone: 'Invalid/City_Nowhere',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid IANA timezone');
    });
  });

  describe('FR-09: Strict Role-Based Access Control (403 Enforcement)', () => {
    it('strictly forbids RECEPTIONIST from accessing staff management (403)', async () => {
      const res = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly forbids RECEPTIONIST from viewing audit logs (403)', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly forbids RECEPTIONIST from viewing application error logs (403)', async () => {
      const res = await request(app)
        .get('/api/v1/app-errors')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly forbids RECEPTIONIST from updating system settings (403)', async () => {
      const res = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ workspaceName: 'Hacked Name' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly forbids RECEPTIONIST from performing attendance corrections (403)', async () => {
      const res = await request(app)
        .patch('/api/v1/attendance/some-id/correct')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ reason: 'Attempt unauthorized fix' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
