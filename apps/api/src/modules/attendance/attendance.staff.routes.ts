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
  phoneNumber: z.string().trim().min(7, 'Invalid phone number').max(20),
  hostName: z.string().trim().min(2, 'Please enter who they are here to see').max(150),
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
  requireRole(Role.RECEPTIONIST, Role.SUPER_ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const activeVisitors = await attendanceService.getActiveSessions();
      res.status(200).json({
        success: true,
        data: activeVisitors,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Receptionist (and Super Admin): Manual visitor check-in
attendanceStaffRouter.post(
  '/manual-check-in',
  requireRole(Role.RECEPTIONIST, Role.SUPER_ADMIN),
  validateBody(manualCheckInSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user!.staffId;
      const result = await attendanceService.manualCheckIn(req.body, actorId);
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
