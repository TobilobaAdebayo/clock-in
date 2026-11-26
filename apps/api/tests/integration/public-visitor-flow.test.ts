import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { visitorsRepository } from '../../src/modules/visitors/visitors.repository.js';
import { attendanceRepository } from '../../src/modules/attendance/attendance.repository.js';
import { prisma } from '../../src/shared/db/prisma.js';

describe('Public Visitor Check-In & Check-Out Flow (M2 Integration)', () => {
  const app = createApp();

  const mockVisitor = {
    id: 'visitor-uuid-1',
    fullName: 'Tobi Lawson',
    phoneNumber: '+2348123456789',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOpenAttendance = {
    id: 'attendance-uuid-1',
    visitorId: 'visitor-uuid-1',
    hostName: 'Mr. Tunde',
    checkIn: new Date(),
    checkOut: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(prisma);
      }
      return cb;
    });
  });

  describe('FR-01 & FR-04: Guest Registration & Automatic Check-In', () => {
    it('registers a new visitor and immediately creates an active attendance session', async () => {
      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(null);
      vi.spyOn(visitorsRepository, 'create').mockResolvedValue(mockVisitor);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(null);
      vi.spyOn(attendanceRepository, 'create').mockResolvedValue(mockOpenAttendance);

      const res = await request(app)
        .post('/api/v1/public/visitors/register')
        .send({
          fullName: 'Tobi Lawson',
          phoneNumber: '08123456789',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.visitor).toHaveProperty('id', 'visitor-uuid-1');
      expect(res.body.data.visitor).toHaveProperty('phoneNumber', '+2348123456789'); // Normalized
      expect(res.body.data.attendance).toHaveProperty('status', 'CHECKED_IN');
      expect(res.body.data.attendance).toHaveProperty('checkIn');
    });

    it('rejects registration if the phone number already exists', async () => {
      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(mockVisitor);

      const res = await request(app)
        .post('/api/v1/public/visitors/register')
        .send({
          fullName: 'Tobi Lawson',
          phoneNumber: '08123456789',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects registration with invalid phone or name', async () => {
      const res = await request(app)
        .post('/api/v1/public/visitors/register')
        .send({
          fullName: 'T',
          phoneNumber: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('requires a phone number when registering through the public landing portal', async () => {
      const res = await request(app)
        .post('/api/v1/public/visitors/register')
        .send({
          fullName: 'Tobi Lawson',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('FR-03 & FR-07: Returning Visitor Lookup & Privacy Protection', () => {
    it('returns masked hint and signed lookup token without exposing full profile details', async () => {
      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(mockVisitor);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(mockOpenAttendance);

      const res = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ phoneNumber: '08123456789' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Privacy check: Never returns raw full name or unmasked phone number
      expect(res.body.data).not.toHaveProperty('fullName');
      expect(res.body.data.maskedName).toBe('T*** L*****');
      expect(res.body.data.maskedPhone).toContain('****');
      expect(res.body.data).toHaveProperty('lookupToken');
      expect(res.body.data).toHaveProperty('checkOutToken');
      expect(res.body.data.hasActiveSession).toBe(true);
    });

    it('allows phone-only checkOutToken to check out without name confirmation, but blocks it from check-in', async () => {
      const closedAttendance = { ...mockOpenAttendance, checkOut: new Date() };
      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(mockVisitor);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(mockOpenAttendance);
      vi.spyOn(attendanceRepository, 'closeSession').mockResolvedValue(closedAttendance);

      const lookupRes = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ phoneNumber: '08123456789' });

      const { checkOutToken } = lookupRes.body.data;
      expect(checkOutToken).toBeTruthy();

      // Must NOT work for check-in (name confirmation is required for signing in)
      const checkInRes = await request(app)
        .post('/api/v1/public/attendance/check-in')
        .send({ actionToken: checkOutToken });
      expect(checkInRes.status).toBe(401);

      // Must succeed directly for check-out
      const checkOutRes = await request(app)
        .post('/api/v1/public/attendance/check-out')
        .send({ actionToken: checkOutToken });
      expect(checkOutRes.status).toBe(200);
      expect(checkOutRes.body.data.status).toBe('CHECKED_OUT');
    });

    it('returns 404 if phone number is not registered', async () => {
      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ phoneNumber: '08099999999' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('confirms visitor identity when full name matches', async () => {
      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(mockVisitor);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(mockOpenAttendance);

      // 1. Get lookup token
      const lookupRes = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ phoneNumber: '08123456789' });

      const { lookupToken } = lookupRes.body.data;

      // 2. Confirm with correct name
      const confirmRes = await request(app)
        .post('/api/v1/public/visitors/confirm')
        .send({
          lookupToken,
          confirmationAnswer: 'Tobi Lawson',
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.data).toHaveProperty('actionToken');
      expect(confirmRes.body.data.visitorId).toBe(mockVisitor.id);
    });

    it('rejects confirmation when full name does not match', async () => {
      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(mockVisitor);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(mockOpenAttendance);

      const lookupRes = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ phoneNumber: '08123456789' });

      const { lookupToken } = lookupRes.body.data;

      const confirmRes = await request(app)
        .post('/api/v1/public/visitors/confirm')
        .send({
          lookupToken,
          confirmationAnswer: 'Alexander Wrong',
        });

      expect(confirmRes.status).toBe(400);
      expect(confirmRes.body.success).toBe(false);
      expect(confirmRes.body.error.message).toContain('does not match');
    });

    it('returns 200 with masked selectable profiles when multiple visitors share the same full name', async () => {
      const duplicateVisitor = {
        ...mockVisitor,
        id: 'visitor-uuid-2',
        phoneNumber: null,
      };
      vi.spyOn(visitorsRepository, 'findByFullName').mockResolvedValue([
        mockVisitor,
        duplicateVisitor,
      ]);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId')
        .mockResolvedValueOnce(mockOpenAttendance)
        .mockResolvedValueOnce(null);

      const lookupRes = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ identifier: 'Tobi Lawson' });

      expect(lookupRes.status).toBe(200);
      expect(lookupRes.body.success).toBe(true);
      expect(lookupRes.body.data.multipleMatches).toBe(true);
      expect(lookupRes.body.data.matches).toHaveLength(2);
      expect(lookupRes.body.data.matches[0]).not.toHaveProperty('fullName');
      expect(lookupRes.body.data.matches[0].maskedPhone).toContain('****');
      expect(lookupRes.body.data.matches[0].hasActiveSession).toBe(true);
      expect(lookupRes.body.data.matches[1].maskedPhone).toBe('Not provided');
      expect(lookupRes.body.data.matches[1].hasActiveSession).toBe(false);

      // Selected candidate's lookupToken can confirm identity cleanly
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValueOnce(null);
      const confirmRes = await request(app)
        .post('/api/v1/public/visitors/confirm')
        .send({
          lookupToken: lookupRes.body.data.matches[1].lookupToken,
          confirmationAnswer: 'Tobi Lawson',
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.visitorId).toBe('visitor-uuid-2');
      expect(confirmRes.body.data).toHaveProperty('actionToken');
    });
  });

  describe('FR-05 & FR-06: Check-In & Check-Out Session Rules', () => {
    it('prevents multiple active sessions (Active Session Rule)', async () => {
      // Mock active session exists
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(mockOpenAttendance);

      const res = await request(app)
        .post('/api/v1/public/attendance/check-in')
        .send({ visitorId: mockVisitor.id });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already checked in');
    });

    it('successfully checks out of an active visit session', async () => {
      const closedAttendance = {
        ...mockOpenAttendance,
        checkOut: new Date(),
      };

      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(mockOpenAttendance);
      vi.spyOn(attendanceRepository, 'closeSession').mockResolvedValue(closedAttendance);

      const res = await request(app)
        .post('/api/v1/public/attendance/check-out')
        .send({ visitorId: mockVisitor.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CHECKED_OUT');
      expect(res.body.data).toHaveProperty('checkOut');
    });

    it('returns an error when checking out with no open session', async () => {
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/public/attendance/check-out')
        .send({ visitorId: mockVisitor.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('No active visit session found');
    });

    it('does not show a visitor as signed in on a new day if they forgot to clock out yesterday, and auto-closes the previous-day session on new check-in', async () => {
      const yesterdaySession = {
        ...mockOpenAttendance,
        id: 'attendance-yesterday-1',
        checkIn: new Date(Date.now() - 30 * 3600_000),
        checkOut: null,
      };
      const todayNewSession = {
        ...mockOpenAttendance,
        id: 'attendance-today-1',
        checkIn: new Date(),
        checkOut: null,
      };

      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(mockVisitor);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(yesterdaySession);
      const closeSpy = vi
        .spyOn(attendanceRepository, 'closeSession')
        .mockResolvedValue({ ...yesterdaySession, checkOut: new Date() });
      const createSpy = vi
        .spyOn(attendanceRepository, 'create')
        .mockResolvedValue(todayNewSession);

      // 1. Lookup on the new day must NOT show them as currently signed in
      const lookupRes = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ phoneNumber: '08123456789' });

      expect(lookupRes.status).toBe(200);
      expect(lookupRes.body.data.hasActiveSession).toBe(false);
      expect(lookupRes.body.data.checkOutToken).toBeNull();

      // 2. Clocking in today succeeds and auto-closes yesterday's unclosed session
      const checkInRes = await request(app)
        .post('/api/v1/public/attendance/check-in')
        .send({ visitorId: mockVisitor.id, hostName: 'Programs Team' });

      expect(checkInRes.status).toBe(201);
      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(closeSpy.mock.calls[0][0]).toBe('attendance-yesterday-1');
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });
});
