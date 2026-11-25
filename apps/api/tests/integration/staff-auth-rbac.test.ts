import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { staffRepository } from '../../src/modules/staff/staff.repository.js';
import { sessionRepository } from '../../src/modules/auth/session.repository.js';
import { hashPassword } from '../../src/shared/utils/crypto.js';
import { tokenService } from '../../src/modules/auth/token.service.js';
import { Role } from '@prisma/client';

describe('Staff Authentication & Role-Based Access Control (M3)', () => {
  const app = createApp();

  let receptionistStaff: any;
  let superAdminStaff: any;
  let deactivatedStaff: any;

  beforeEach(async () => {
    vi.restoreAllMocks();

    const hashedPassword = await hashPassword('CorrectPassword123!');

    receptionistStaff = {
      id: 'staff-receptionist-uuid',
      fullName: 'Front Desk Receptionist',
      email: 'receptionist@clockin.workspace',
      passwordHash: hashedPassword,
      role: Role.RECEPTIONIST,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    superAdminStaff = {
      id: 'staff-admin-uuid',
      fullName: 'System Administrator',
      email: 'admin@clockin.workspace',
      passwordHash: hashedPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    deactivatedStaff = {
      id: 'staff-deactivated-uuid',
      fullName: 'Former Employee',
      email: 'former@clockin.workspace',
      passwordHash: hashedPassword,
      role: Role.RECEPTIONIST,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('FR-08: Staff Login & Credentials Verification', () => {
    it('successfully signs in receptionist with valid credentials and sets refresh cookie', async () => {
      vi.spyOn(staffRepository, 'findByEmail').mockResolvedValue(receptionistStaff);
      vi.spyOn(sessionRepository, 'createSession').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'receptionist@clockin.workspace',
          password: 'CorrectPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.staff.role).toBe('RECEPTIONIST');

      // Check for httpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken');
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('rejects login with incorrect password', async () => {
      vi.spyOn(staffRepository, 'findByEmail').mockResolvedValue(receptionistStaff);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'receptionist@clockin.workspace',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid email or password');
    });

    it('blocks login for deactivated staff accounts', async () => {
      vi.spyOn(staffRepository, 'findByEmail').mockResolvedValue(deactivatedStaff);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'former@clockin.workspace',
          password: 'CorrectPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('FR-08: Session Refresh & Revocation', () => {
    it('rotates refresh token and issues a new access token', async () => {
      const activeSession = {
        id: 'session-uuid-1',
        staffId: receptionistStaff.id,
        tokenHash: 'sample-hash',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        createdAt: new Date(),
        staff: receptionistStaff,
      };

      vi.spyOn(sessionRepository, 'findActiveByTokenHash').mockResolvedValue(activeSession as any);
      vi.spyOn(sessionRepository, 'revokeSession').mockResolvedValue({} as any);
      vi.spyOn(sessionRepository, 'createSession').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'valid-raw-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(sessionRepository.revokeSession).toHaveBeenCalledWith('session-uuid-1');
    });

    it('rejects revoked or invalid refresh token', async () => {
      vi.spyOn(sessionRepository, 'findActiveByTokenHash').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'revoked-token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('FR-09: Role Matrix & Server-Side Authorization', () => {
    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/v1/protected/receptionist-test');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('allows RECEPTIONIST to access receptionist endpoints', async () => {
      vi.spyOn(staffRepository, 'findById').mockResolvedValue(receptionistStaff);

      const token = tokenService.generateAccessToken({
        staffId: receptionistStaff.id,
        email: receptionistStaff.email,
        role: Role.RECEPTIONIST,
        fullName: receptionistStaff.fullName,
      });

      const res = await request(app)
        .get('/api/v1/protected/receptionist-test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows SUPER_ADMIN to access receptionist endpoints (hierarchical access)', async () => {
      vi.spyOn(staffRepository, 'findById').mockResolvedValue(superAdminStaff);

      const token = tokenService.generateAccessToken({
        staffId: superAdminStaff.id,
        email: superAdminStaff.email,
        role: Role.SUPER_ADMIN,
        fullName: superAdminStaff.fullName,
      });

      const res = await request(app)
        .get('/api/v1/protected/receptionist-test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('strictly forbids RECEPTIONIST from accessing SUPER_ADMIN endpoints (returns 403)', async () => {
      vi.spyOn(staffRepository, 'findById').mockResolvedValue(receptionistStaff);

      const token = tokenService.generateAccessToken({
        staffId: receptionistStaff.id,
        email: receptionistStaff.email,
        role: Role.RECEPTIONIST,
        fullName: receptionistStaff.fullName,
      });

      const res = await request(app)
        .get('/api/v1/protected/admin-test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows SUPER_ADMIN to access SUPER_ADMIN endpoints', async () => {
      vi.spyOn(staffRepository, 'findById').mockResolvedValue(superAdminStaff);

      const token = tokenService.generateAccessToken({
        staffId: superAdminStaff.id,
        email: superAdminStaff.email,
        role: Role.SUPER_ADMIN,
        fullName: superAdminStaff.fullName,
      });

      const res = await request(app)
        .get('/api/v1/protected/admin-test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('invalidates existing tokens immediately if staff account is deactivated in DB', async () => {
      vi.spyOn(staffRepository, 'findById').mockResolvedValue(deactivatedStaff);

      const token = tokenService.generateAccessToken({
        staffId: deactivatedStaff.id,
        email: deactivatedStaff.email,
        role: Role.RECEPTIONIST,
        fullName: deactivatedStaff.fullName,
      });

      const res = await request(app)
        .get('/api/v1/protected/receptionist-test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('deactivated or removed');
    });
  });
});
