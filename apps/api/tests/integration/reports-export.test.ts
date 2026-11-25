import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { reportsRepository } from '../../src/modules/reports/reports.repository.js';
import { tokenService } from '../../src/modules/auth/token.service.js';
import { Role } from '@prisma/client';

describe('Reports & Excel Export (M5 Integration)', () => {
  const app = createApp();

  const receptionistStaff = {
    id: 'staff-receptionist-uuid',
    fullName: 'Front Desk Receptionist',
    email: 'receptionist@clockin.workspace',
    passwordHash: 'hash',
    role: Role.RECEPTIONIST,
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let receptionistToken: string;

  const mockExportRecords = [
    {
      id: 'att-1',
      checkIn: new Date('2026-11-24T09:00:00Z'),
      checkOut: new Date('2026-11-24T17:00:00Z'),
      visitor: {
        fullName: 'Alexander Hamilton',
        phoneNumber: '+2348011223344',
      },
    },
    {
      id: 'att-2',
      checkIn: new Date('2026-11-24T10:30:00Z'),
      checkOut: null, // Active
      visitor: {
        fullName: 'Folake Adeleke',
        phoneNumber: '+2348099887766',
      },
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(staffRepository, 'findById').mockResolvedValue(receptionistStaff);

    receptionistToken = tokenService.generateAccessToken({
      staffId: receptionistStaff.id,
      email: receptionistStaff.email,
      role: Role.RECEPTIONIST,
      fullName: receptionistStaff.fullName,
    });

    // Mock streamBatches to feed mock records to the callback
    vi.spyOn(reportsRepository, 'streamBatches').mockImplementation(
      async (_criteria, _batchSize, _maxRows, onBatch) => {
        await onBatch(mockExportRecords as any);
        return mockExportRecords.length;
      },
    );
  });

  describe('FR-15: Excel Export Endpoints for All 5 Report Types', () => {
    it('generates a valid .xlsx file for DAILY report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=DAILY')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('attachment; filename="attendance_daily_');
      // Verify ZIP/XLSX header signature (PK\x03\x04 = 0x50, 0x4b, 0x03, 0x04)
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('generates a valid .xlsx file for WEEKLY report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=WEEKLY')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.body[0]).toBe(0x50);
    });

    it('generates a valid .xlsx file for MONTHLY report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=MONTHLY')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.body[0]).toBe(0x50);
    });

    it('generates a valid .xlsx file for CUSTOM date range report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=CUSTOM&startDate=2026-11-01&endDate=2026-11-30')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.body[0]).toBe(0x50);
    });

    it('generates a valid .xlsx file for individual VISITOR report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=VISITOR&visitorId=visitor-uuid-1')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.body[0]).toBe(0x50);
    });

    it('generates a valid .pdf file when format=pdf is requested', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=DAILY&format=pdf')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('.pdf');
      // Verify PDF header signature (%PDF = 0x25, 0x50, 0x44, 0x46)
      expect(res.body[0]).toBe(0x25);
      expect(res.body[1]).toBe(0x50);
      expect(res.body[2]).toBe(0x44);
      expect(res.body[3]).toBe(0x46);
    });
  });

  describe('Validation & Security', () => {
    it('rejects export request without report type', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Report type is required');
    });

    it('rejects CUSTOM report without start or end date', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=CUSTOM')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated export request with 401', async () => {
      const res = await request(app).get('/api/v1/reports/export?type=DAILY');
      expect(res.status).toBe(401);
    });
  });
});
