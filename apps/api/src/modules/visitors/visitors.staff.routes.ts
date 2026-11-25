import { Router, Request, Response, NextFunction } from 'express';
import { visitorsService } from './visitors.service.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/authorize.js';
import { Role } from '@prisma/client';

export const visitorsStaffRouter: Router = Router();

// Staff authentication required for all routes
visitorsStaffRouter.use(authenticate, requireRole(Role.RECEPTIONIST, Role.SUPER_ADMIN));

visitorsStaffRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await visitorsService.listVisitors(req.query as Record<string, unknown>);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

visitorsStaffRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await visitorsService.getVisitorProfile(req.params.id);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

visitorsStaffRouter.get('/:id/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await visitorsService.getVisitorAttendanceHistory(
      req.params.id,
      req.query as Record<string, unknown>,
    );
    res.status(200).json({
      success: true,
      data: history.data,
      meta: history.meta,
    });
  } catch (error) {
    next(error);
  }
});
