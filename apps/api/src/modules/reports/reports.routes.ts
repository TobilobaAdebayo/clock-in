import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { Role } from '@prisma/client';

export const reportsRouter: Router = Router();

// Staff authentication required for Excel reports (Receptionist or Super Admin)
reportsRouter.use(authenticate, requireRole(Role.RECEPTIONIST, Role.SUPER_ADMIN));

reportsRouter.get('/export', reportsController.exportReport);
