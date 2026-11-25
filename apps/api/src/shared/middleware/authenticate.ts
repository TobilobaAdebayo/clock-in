import { Request, Response, NextFunction } from 'express';
import { tokenService, AuthUserPayload } from '../../modules/auth/token.service.js';
import { staffRepository } from '../../modules/staff/staff.repository.js';
import { UnauthorizedError } from '../errors/app-error.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required. Missing Bearer token.');
    }

    const token = authHeader.split(' ')[1];
    const payload = tokenService.verifyAccessToken(token);

    if (!payload || !payload.staffId) {
      throw new UnauthorizedError('Invalid or expired authentication token.');
    }

    // Verify staff account is still active in the database
    const staff = await staffRepository.findById(payload.staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError('Staff account has been deactivated or removed.');
    }

    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};
