import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { visitorsRepository } from '../../src/modules/visitors/visitors.repository.js';
import { attendanceRepository } from '../../src/modules/attendance/attendance.repository.js';
import { tokenService } from '../../src/modules/auth/token.service.js';
import { prisma } from '../../src/shared/db/prisma.js';
import { Role } from '@prisma/client';

describe('Receptionist Dashboard, Directory & Profiles (M4 Integration)', () => {
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

  const mockVisitors = [
    {
      id: 'vis-1',
      fullName: 'Adebayo Ogunlesi',
      phoneNumber: '+2348031112233',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'vis-2',
      fullName: 'Chinwe Okeke',
      phoneNumber: '+2348094445566',
      createdAt: new Date(),
      updatedAt: new Date(),
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
  });

  describe('FR-10 & FR-13: Dashboard Metrics & Summary', () => {
    it('returns dashboard summary metrics in workspace timezone', async () => {
      // Mock prisma count calls for dashboard
      vi.spyOn(prisma.attendance, 'count')
        .mockResolvedValueOnce(5) // todayVisits
        .mockResolvedValueOnce(2) // currentlyCheckedIn
        .mockResolvedValueOnce(18) // thisWeekVisits
        .mockResolvedValueOnce(45); // thisMonthVisits

      vi.spyOn(prisma.attendance, 'findMany').mockResolvedValue([
        {
          id: 'att-1',
          visitorId: 'vis-1',
          checkIn: new Date(),
          checkOut: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          visitor: {
            id: 'vis-1',
            fullName: 'Adebayo Ogunlesi',
            phoneNumber: '+2348031112233',
          },
        },
      ] as any);

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.todayVisits).toBe(5);
      expect(res.body.data.metrics.currentlyCheckedIn).toBe(2);
      expect(res.body.data.metrics.thisWeekVisits).toBe(18);
      expect(res.body.data.metrics.thisMonthVisits).toBe(45);
      expect(res.body.data.recentCheckIns).toHaveLength(1);
    });

    it('rejects unauthenticated request to dashboard summary with 401', async () => {
      const res = await request(app).get('/api/v1/dashboard/summary');
      expect(res.status).toBe(401);
    });
  });

  describe('FR-11: Visitor Directory with Search & Pagination', () => {
    it('returns paginated visitor records with pagination metadata', async () => {
      vi.spyOn(visitorsRepository, 'findManyPaginated').mockResolvedValue([mockVisitors, 2]);

      const res = await request(app)
        .get('/api/v1/visitors?page=1&limit=10')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('filters directory by search query parameter', async () => {
      const filtered = [mockVisitors[0]];
      const spy = vi.spyOn(visitorsRepository, 'findManyPaginated').mockResolvedValue([filtered, 1]);

      const res = await request(app)
        .get('/api/v1/visitors?search=Adebayo')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ search: 'Adebayo' }));
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].fullName).toBe('Adebayo Ogunlesi');
    });
  });

  describe('FR-12 & FR-13: Visitor Profile & Historical Attendance', () => {
    it('returns visitor profile with weekly and monthly visit counts', async () => {
      vi.spyOn(visitorsRepository, 'findById').mockResolvedValue(mockVisitors[0]);
      vi.spyOn(visitorsRepository, 'getVisitorStats').mockResolvedValue({
        totalVisits: 12,
        thisWeekVisits: 3,
        thisMonthVisits: 8,
        lastVisit: { checkIn: new Date() } as any,
        activeSession: null,
      });

      const res = await request(app)
        .get('/api/v1/visitors/vis-1')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.visitor.fullName).toBe('Adebayo Ogunlesi');
      expect(res.body.data.stats.totalVisits).toBe(12);
      expect(res.body.data.stats.thisWeekVisits).toBe(3);
      expect(res.body.data.stats.thisMonthVisits).toBe(8);
      expect(res.body.data.stats.currentlyCheckedIn).toBe(false);
    });

    it('returns 404 for non-existent visitor profile', async () => {
      vi.spyOn(visitorsRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/visitors/non-existent-id')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns paginated attendance history for visitor', async () => {
      vi.spyOn(visitorsRepository, 'findById').mockResolvedValue(mockVisitors[0]);
      vi.spyOn(visitorsRepository, 'findAttendanceHistoryPaginated').mockResolvedValue([
        [
          {
            id: 'att-1',
            visitorId: 'vis-1',
            hostName: 'Operations Lead',
            checkIn: new Date(),
            checkOut: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        1,
      ]);

      const res = await request(app)
        .get('/api/v1/visitors/vis-1/attendance?page=1&limit=5')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('FR-10 & FR-14: Filtered Attendance Records & Active Visitors', () => {
    it('returns filtered attendance records', async () => {
      vi.spyOn(attendanceRepository, 'findManyFiltered').mockResolvedValue([
        [
          {
            id: 'att-1',
            visitorId: 'vis-1',
            checkIn: new Date(),
            checkOut: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            visitor: mockVisitors[0],
          },
        ],
        1,
      ]);

      const res = await request(app)
        .get('/api/v1/attendance?status=ACTIVE')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns currently active visitors in the space', async () => {
      vi.spyOn(attendanceRepository, 'findActiveSessions').mockResolvedValue([
        {
          id: 'att-1',
          visitorId: 'vis-1',
          checkIn: new Date(),
          checkOut: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          visitor: mockVisitors[0],
        },
      ]);

      const res = await request(app)
        .get('/api/v1/attendance/active')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].visitor.fullName).toBe('Adebayo Ogunlesi');
    });
  });
});
