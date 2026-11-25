import { Request, Response, NextFunction, CookieOptions } from 'express';
import { authService, AuthService } from './auth.service.js';
import { env } from '../../config/env.js';

const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
});

export class AuthController {
  constructor(private service: AuthService = authService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await this.service.login(email, password);

      if (result.requiresTwoFactor) {
        res.status(200).json({
          success: true,
          message: 'Enter the 6-digit code from Google Authenticator to finish signing in.',
          data: {
            requiresTwoFactor: true,
            challengeToken: result.challengeToken,
            expiresInSeconds: result.expiresInSeconds,
          },
        });
        return;
      }

      res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Signed in successfully.',
        data: {
          requiresTwoFactor: false,
          accessToken: result.accessToken,
          staff: result.staff,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  verifyTwoFactorLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { challengeToken, code } = req.body;
      const result = await this.service.verifyTwoFactorLogin(challengeToken, code);

      res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Signed in successfully.',
        data: {
          accessToken: result.accessToken,
          staff: result.staff,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  startTotpSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.user!.staffId;
      const result = await this.service.startTotpSetup(staffId);

      res.status(200).json({
        success: true,
        message: 'Scan the QR code with Google Authenticator and enter the 6-digit code.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  confirmTotpSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.user!.staffId;
      const { setupToken, code } = req.body;
      const staff = await this.service.confirmTotpSetup(staffId, setupToken, code);

      res.status(200).json({
        success: true,
        message: 'Google Authenticator 2FA has been enabled.',
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  };

  disableTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.user!.staffId;
      const { password } = req.body;
      const staff = await this.service.disableTwoFactor(staffId, password);

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication has been disabled.',
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      const result = await this.service.refresh(refreshToken);

      res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Session refreshed successfully.',
        data: {
          accessToken: result.accessToken,
          staff: result.staff,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      await this.service.logout(refreshToken);

      const { maxAge: _maxAge, ...clearOpts } = getRefreshCookieOptions();
      res.clearCookie('refreshToken', clearOpts);

      res.status(200).json({
        success: true,
        message: 'Signed out successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const profile = await this.service.getMe(user.staffId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
