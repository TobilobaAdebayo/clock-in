import { Router } from 'express';
import { attendanceController } from './attendance.controller.js';
import { publicRateLimiter } from '../../shared/middleware/rate-limiters.js';

export const attendancePublicRouter: Router = Router();

attendancePublicRouter.use(publicRateLimiter);

attendancePublicRouter.post('/check-in', attendanceController.checkIn);
attendancePublicRouter.post('/check-out', attendanceController.checkOut);
