import { Router } from 'express';
import { z } from 'zod';
import { authController } from './auth.controller.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { authRateLimiter, refreshRateLimiter } from '../../shared/middleware/rate-limiters.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { LoginSchema } from '@clock-in/shared';

export const authRouter: Router = Router();

const verifyLoginTotpSchema = z.object({
  challengeToken: z.string().min(1, 'Challenge token is required'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be a 6-digit number'),
});

const confirmSetupTotpSchema = z.object({
  setupToken: z.string().min(1, 'Setup token is required'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be a 6-digit number'),
});

const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Current password is required'),
});

authRouter.post('/login', authRateLimiter, validateBody(LoginSchema), authController.login);
authRouter.post(
  '/2fa/verify-login',
  authRateLimiter,
  validateBody(verifyLoginTotpSchema),
  authController.verifyTwoFactorLogin,
);
authRouter.post('/2fa/setup', authenticate, authController.startTotpSetup);
authRouter.post(
  '/2fa/enable',
  authenticate,
  validateBody(confirmSetupTotpSchema),
  authController.confirmTotpSetup,
);
authRouter.post(
  '/2fa/disable',
  authenticate,
  validateBody(disableTwoFactorSchema),
  authController.disableTwoFactor,
);
authRouter.post('/refresh', refreshRateLimiter, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.getMe);
