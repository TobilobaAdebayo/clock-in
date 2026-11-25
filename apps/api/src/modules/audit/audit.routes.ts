import { Router } from 'express';
import { auditController } from './audit.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { Role } from '@prisma/client';

export const auditRouter: Router = Router();

// Super Admin only (FR-18)
auditRouter.use(authenticate, requireRole(Role.SUPER_ADMIN));

auditRouter.get('/', auditController.listLogs);
