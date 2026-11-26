import { Request, Response, NextFunction } from 'express';
import { visitorsService, VisitorsService } from './visitors.service.js';

export class VisitorsController {
  constructor(private service: VisitorsService = visitorsService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Registration and initial check-in completed successfully. Welcome!',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  lookup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = req.body.identifier || req.body.phoneNumber;
      const result = await this.service.lookup(identifier);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { lookupToken, confirmationAnswer } = req.body;
      const result = await this.service.confirm(lookupToken, confirmationAnswer);
      res.status(200).json({
        success: true,
        message: 'Identity confirmed successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const visitorsController = new VisitorsController();
