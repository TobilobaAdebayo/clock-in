import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { authRateLimiter, refreshRateLimiter } from '../../shared/middleware/rate-limiters.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { LoginSchema } from '@clock-in/shared';

export const authRouter: Router = Router();

authRouter.post('/login', authRateLimiter, validateBody(LoginSchema), authController.login);
authRouter.post('/refresh', refreshRateLimiter, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.getMe);
