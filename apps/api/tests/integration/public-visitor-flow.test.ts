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
  });
});
