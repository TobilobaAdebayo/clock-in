import { Router } from 'express';
import { staffController } from './staff.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { Role } from '@prisma/client';
import { z } from 'zod';

export const staffRouter: Router = Router();

const createStaffSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(Role),
  isActive: z.boolean().optional(),
});

const updateStaffSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(Role).optional(),
  isActive: z.boolean().optional(),
});

// Super Admin only (FR-16)
staffRouter.use(authenticate, requireRole(Role.SUPER_ADMIN));

staffRouter.get('/', staffController.listStaff);
staffRouter.get('/:id', staffController.getStaff);
staffRouter.post('/', validateBody(createStaffSchema), staffController.createStaff);
staffRouter.patch('/:id', validateBody(updateStaffSchema), staffController.updateStaff);
staffRouter.post('/:id/deactivate', staffController.deactivateStaff);
staffRouter.post('/:id/reset-2fa', staffController.resetTwoFactor);
