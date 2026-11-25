import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes.js';
import { visitorsPublicRouter } from '../modules/visitors/visitors.public.routes.js';
import { visitorsStaffRouter } from '../modules/visitors/visitors.staff.routes.js';
import { attendancePublicRouter } from '../modules/attendance/attendance.public.routes.js';
import { attendanceStaffRouter } from '../modules/attendance/attendance.staff.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { reportsRouter } from '../modules/reports/reports.routes.js';
import { staffRouter } from '../modules/staff/staff.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';
import { appErrorsRouter } from '../modules/app-errors/app-errors.routes.js';
import { settingsRouter } from '../modules/settings/settings.routes.js';
import { authenticate } from '../shared/middleware/authenticate.js';
import { requireRole } from '../shared/middleware/authorize.js';
import { Role } from '@prisma/client';

export const rootRouter: Router = Router();

// Root health checks
rootRouter.use('/', healthRouter);

// Versioned API routes prefix
export const v1Router: Router = Router();

v1Router.get('/status', (_req, res) => {
  res.json({ message: 'CLOCK IN API v1 operational' });
});

// Staff Authentication Routes (FR-08)
v1Router.use('/auth', authRouter);

// Public Guest Routes (FR-01 to FR-07)
v1Router.use('/public/visitors', visitorsPublicRouter);
v1Router.use('/public/attendance', attendancePublicRouter);

// Staff Dashboard Routes (FR-10, FR-13)
v1Router.use('/dashboard', dashboardRouter);

// Staff Visitor Directory & Profile Routes (FR-11, FR-12)
v1Router.use('/visitors', visitorsStaffRouter);

// Staff Attendance Records & Active Visitors Routes (FR-10, FR-14)
v1Router.use('/attendance', attendanceStaffRouter);

// Staff Reports & Excel Export Routes (FR-15)
v1Router.use('/reports', reportsRouter);

// Super Admin Tools (M6: FR-16 to FR-20)
v1Router.use('/staff', staffRouter);
v1Router.use('/audit-logs', auditRouter);
v1Router.use('/app-errors', appErrorsRouter);
v1Router.use('/settings', settingsRouter);

// Protected Route Stubs for Role Matrix Verification (FR-09)
export const protectedRouter: Router = Router();

protectedRouter.get(
  '/receptionist-test',
  authenticate,
  requireRole(Role.RECEPTIONIST, Role.SUPER_ADMIN),
  (_req, res) => {
    res.json({ success: true, message: 'Receptionist area accessible' });
  },
);

protectedRouter.get(
  '/admin-test',
  authenticate,
  requireRole(Role.SUPER_ADMIN),
  (_req, res) => {
    res.json({ success: true, message: 'Super Admin area accessible' });
  },
);

v1Router.use('/protected', protectedRouter);
