import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { Role } from '@prisma/client';
import { z } from 'zod';

export const settingsRouter: Router = Router();

const updateSettingsSchema = z.object({
  workspaceName: z.string().min(2, 'Workspace name must be at least 2 characters').optional(),
  workspaceTimezone: z.string().min(2, 'Workspace timezone must be a valid IANA identifier').optional(),
});

// Any authenticated staff can view workspace settings
settingsRouter.get('/', authenticate, settingsController.getSettings);

// Super Admin only can update workspace settings (FR-20)
settingsRouter.patch(
  '/',
  authenticate,
  requireRole(Role.SUPER_ADMIN),
  validateBody(updateSettingsSchema),
  settingsController.updateSettings,
);
