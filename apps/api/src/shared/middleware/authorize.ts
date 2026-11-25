import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

/**
 * Server-side Role-Based Access Control (RBAC) middleware (FR-09).
 * Enforces permissions for RECEPTIONIST and SUPER_ADMIN.
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: requires ${allowedRoles.join(' or ')} permission.`,
        ),
      );
    }

    next();
  };
};
