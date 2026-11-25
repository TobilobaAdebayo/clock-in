import { Router } from 'express';
import { appErrorsController } from './app-errors.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { Role } from '@prisma/client';

export const appErrorsRouter: Router = Router();

// Super Admin only (FR-19)
appErrorsRouter.use(authenticate, requireRole(Role.SUPER_ADMIN));

appErrorsRouter.get('/', appErrorsController.listErrors);
appErrorsRouter.patch('/:id/resolve', appErrorsController.resolveError);
