import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/db/prisma.js';
import { attendanceRepository } from '../../src/modules/attendance/attendance.repository.js';
import { visitorsRepository } from '../../src/modules/visitors/visitors.repository.js';
import { appErrorsRepository } from '../../src/modules/app-errors/app-errors.repository.js';
import { appErrorsService } from '../../src/modules/app-errors/app-errors.service.js';

describe('M7 Hardening: Concurrency, Security & Privacy Verification', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(prisma);
      }
      return cb;
    });
  });

  describe('Reliability: Concurrent Check-In Protection (FR-06)', () => {
    it('allows only 1 check-in to succeed when 5 requests race simultaneously', async () => {
      const visitorId = 'visitor-race-1';
      let activeSession: any = null;

      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockImplementation(async () => {
        return activeSession;
      });

      vi.spyOn(attendanceRepository, 'create').mockImplementation(async (vid) => {
        if (activeSession) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`visitor_id`)',
            { code: 'P2002', clientVersion: '6.4.1' },
          );
        }
        activeSession = {
          id: 'att-race-1',
          visitorId: vid,
          checkIn: new Date(),
          checkOut: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return activeSession;
      });

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app)
            .post('/api/v1/public/attendance/check-in')
            .send({ visitorId }),
        ),
      );

      const created = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(created).toHaveLength(1);
      expect(conflicts).toHaveLength(4);
      conflicts.forEach((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('CONFLICT');
      });
    });

    it('translates PostgreSQL partial unique index P2002 race into clean 409 Conflict', async () => {
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(null);
      vi.spyOn(attendanceRepository, 'create').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on index unique_open_attendance_session',
          { code: 'P2002', clientVersion: '6.4.1' },
        ),
      );

      const res = await request(app)
        .post('/api/v1/public/attendance/check-in')
        .send({ visitorId: 'visitor-race-p2002' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already checked in');
    });
  });

  describe('Privacy: No PII Leakage in Lookup Tokens or Persisted Error Logs', () => {
    it('does not embed plaintext fullName or phoneNumber inside the lookupToken payload', async () => {
      const mockVisitor = {
        id: 'visitor-priv-1',
        fullName: 'Adaeze Okafor',
        phoneNumber: '+2348098765432',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(visitorsRepository, 'findByPhoneNumber').mockResolvedValue(mockVisitor);
      vi.spyOn(attendanceRepository, 'findActiveByVisitorId').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/public/visitors/lookup')
        .send({ phoneNumber: '08098765432' });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBeUndefined();
      expect(res.body.data.phoneNumber).toBeUndefined();

      // Inspect raw decoded base64url segment of lookupToken
      const token: string = res.body.data.lookupToken;
      const decodedPayload = Buffer.from(token.split('.')[0], 'base64url').toString('utf8');

      expect(decodedPayload).not.toContain('Adaeze');
      expect(decodedPayload).not.toContain('Okafor');
      expect(decodedPayload).not.toContain('2348098765432');
      expect(decodedPayload).not.toContain('08098765432');
    });

    it('redacts phone numbers, tokens, and DB passwords before persisting AppError records', async () => {
      const createSpy = vi.spyOn(appErrorsRepository, 'create').mockImplementation(async (data: any) => ({
        id: 'err-1',
        errorType: data.errorType,
        message: data.message,
        severity: data.severity || 'HIGH',
        status: 'OPEN',
        stack: data.stack || null,
        createdAt: new Date(),
        resolvedAt: null,
      }));

      await appErrorsService.recordError({
        errorType: 'DatabaseError',
        message: 'Failed for phone +2348098765432 using postgresql://admin:TopSecret99@db:5432/app and password=MyPass123',
        stack: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature123',
      });

      expect(createSpy).toHaveBeenCalledTimes(1);
      const saved = createSpy.mock.calls[0][0];
      expect(saved.message).not.toContain('+2348098765432');
      expect(saved.message).not.toContain('TopSecret99');
      expect(saved.message).not.toContain('MyPass123');
      expect(saved.stack).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });
  });

  describe('Security: Headers, CORS Allow-List, Rate Limits & Input Size Limits', () => {
    it('sets hardened Helmet security headers and hides x-powered-by', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('allows configured CORS origin and blocks unauthorized origins with 403', async () => {
      const allowedRes = await request(app)
        .get('/api/v1/status')
        .set('Origin', 'http://localhost:3000');

      expect(allowedRes.status).toBe(200);
      expect(allowedRes.headers['access-control-allow-origin']).toBe('http://localhost:3000');

      const blockedRes = await request(app)
        .get('/api/v1/status')
        .set('Origin', 'https://malicious.example.com');

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe('FORBIDDEN');
    });

    it('includes standard rate-limit headers on API endpoints', async () => {
      const res = await request(app).get('/api/v1/status');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });

    it('rejects oversized JSON payloads (>100kb) with 413 Payload Too Large', async () => {
      const oversizedPayload = {
        fullName: 'A'.repeat(120 * 1024),
        phoneNumber: '08012345678',
      };

      const res = await request(app)
        .post('/api/v1/public/visitors/register')
        .send(oversizedPayload);

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });
});
