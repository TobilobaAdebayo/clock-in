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

      // Set rotating refresh token in httpOnly cookie
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
