import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { Role } from '@prisma/client';

export const dashboardRouter: Router = Router();

// Staff authentication required (Receptionist or Super Admin)
dashboardRouter.use(authenticate, requireRole(Role.RECEPTIONIST, Role.SUPER_ADMIN));

dashboardRouter.get('/summary', dashboardController.getSummary);
