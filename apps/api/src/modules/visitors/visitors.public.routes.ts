import { Router } from 'express';
import { visitorsController } from './visitors.controller.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { publicRateLimiter, lookupRateLimiter } from '../../shared/middleware/rate-limiters.js';
import {
  RegisterVisitorSchema,
  LookupVisitorSchema,
  ConfirmVisitorIdentitySchema,
} from '@clock-in/shared';

export const visitorsPublicRouter: Router = Router();

visitorsPublicRouter.use(publicRateLimiter);

visitorsPublicRouter.post(
  '/register',
  validateBody(RegisterVisitorSchema),
  visitorsController.register,
);

visitorsPublicRouter.post(
  '/lookup',
  lookupRateLimiter,
  validateBody(LookupVisitorSchema),
  visitorsController.lookup,
);

visitorsPublicRouter.post(
  '/confirm',
  validateBody(ConfirmVisitorIdentitySchema),
  visitorsController.confirm,
);
