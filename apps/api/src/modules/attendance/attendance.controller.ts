import { Request, Response, NextFunction } from 'express';
import { attendanceService, AttendanceService } from './attendance.service.js';
import { verifyLookupToken } from '../../shared/utils/crypto.js';
import { env } from '../../config/env.js';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error.js';

export class AttendanceController {
  constructor(private service: AttendanceService = attendanceService) { }

  checkIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { visitorId, actionToken, hostName } = req.body;

      let targetVisitorId = visitorId;

      // If actionToken is provided (from confirmed returning visitor flow), verify it
      if (actionToken) {
        const payload = verifyLookupToken<{ visitorId: string; confirmed: boolean; scope?: string }>(
          actionToken,
          env.JWT_ACCESS_SECRET,
        );
        if (!payload || !payload.visitorId || !payload.confirmed || payload.scope === 'CHECK_OUT_ONLY') {
          throw new UnauthorizedError('Invalid or expired action session. Please confirm your identity again.');
        }
        targetVisitorId = payload.visitorId;
      }

      if (!targetVisitorId) {
        throw new BadRequestError('Visitor identification is required for check-in.');
      }

      const cleanHostName = typeof hostName === 'string' ? hostName.trim().slice(0, 150) : undefined;
      const session = await this.service.checkIn(targetVisitorId, cleanHostName);

      res.status(201).json({
        success: true,
        message: 'Check-in successful. Welcome!',
        data: {
          attendanceId: session.id,
          visitorId: session.visitorId,
          hostName: session.hostName,
          checkIn: session.checkIn,
          status: 'CHECKED_IN',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  checkOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { visitorId, actionToken } = req.body;

      let targetVisitorId = visitorId;

      if (actionToken) {
        const payload = verifyLookupToken<{ visitorId: string; confirmed: boolean }>(
          actionToken,
          env.JWT_ACCESS_SECRET,
        );
        if (!payload || !payload.visitorId || !payload.confirmed) {
          throw new UnauthorizedError('Invalid or expired action session. Please confirm your identity again.');
        }
        targetVisitorId = payload.visitorId;
      }

      if (!targetVisitorId) {
        throw new BadRequestError('Visitor identification is required for check-out.');
      }

      const session = await this.service.checkOut(targetVisitorId);

      res.status(200).json({
        success: true,
        message: 'Check-out successful. Have a wonderful day!',
        data: {
          attendanceId: session.id,
          visitorId: session.visitorId,
          checkIn: session.checkIn,
          checkOut: session.checkOut,
          status: 'CHECKED_OUT',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const attendanceController = new AttendanceController();
