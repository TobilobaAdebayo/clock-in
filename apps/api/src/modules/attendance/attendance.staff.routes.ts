import { Router, Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { Role } from '@prisma/client';
import { z } from 'zod';

export const attendanceStaffRouter: Router = Router();

const correctAttendanceSchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().nullable().optional(),
  reason: z.string().min(5, 'Correction reason must be at least 5 characters'),
});

const manualCheckInSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  phoneNumber: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || (val.length >= 7 && val.length <= 20), {
      message: 'Invalid phone number',
    }),
  hostName: z.string().trim().max(150).optional(),
});

// Staff authentication required
attendanceStaffRouter.use(authenticate);

attendanceStaffRouter.get(
  '/',
  requireRole(Role.RECEPTIONIST, Role.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attendanceService.listFiltered(req.query as Record<string, unknown>);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },
);

attendanceStaffRouter.get(
  '/active',
  requireRole(Role.SECURITY, Role.RECEPTIONIST, Role.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const activeVisitors = await attendanceService.getActiveSessions();
      // Privacy: Security does not need visitor phone numbers to sign visitors in/out
      const data =
        req.user!.role === Role.SECURITY
          ? activeVisitors.map((session) => ({
              ...session,
              visitor: session.visitor
                ? { id: session.visitor.id, fullName: session.visitor.fullName }
                : session.visitor,
            }))
          : activeVisitors;
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Security, Receptionist, and Super Admin: Manual visitor check-in
attendanceStaffRouter.post(
  '/manual-check-in',
  requireRole(Role.SECURITY, Role.RECEPTIONIST, Role.SUPER_ADMIN),
  validateBody(manualCheckInSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user!.staffId;
      const actorRole = req.user!.role;
      const result = await attendanceService.manualCheckIn(req.body, actorId, actorRole);
      res.status(201).json({
        success: true,
        message: 'Visitor checked in successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Security, Receptionist, and Super Admin: Manual visitor check-out
attendanceStaffRouter.post(
  '/:id/manual-check-out',
  requireRole(Role.SECURITY, Role.RECEPTIONIST, Role.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = req.user!.staffId;
      const actorRole = req.user!.role;
      const closed = await attendanceService.manualCheckOut(id, actorId, actorRole);
      res.status(200).json({
        success: true,
        message: 'Visitor signed out successfully.',
        data: closed,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Super Admin only: Correct attendance session (FR-17)
attendanceStaffRouter.patch(
  '/:id/correct',
  requireRole(Role.SUPER_ADMIN),
  validateBody(correctAttendanceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = req.user!.staffId;
      const updated = await attendanceService.correctAttendance(id, req.body, actorId);
      res.status(200).json({
        success: true,
        message: 'Attendance record corrected successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);
