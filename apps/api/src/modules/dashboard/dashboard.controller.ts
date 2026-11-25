import { Request, Response, NextFunction } from 'express';
import { dashboardService, DashboardService } from './dashboard.service.js';

export class DashboardController {
  constructor(private service: DashboardService = dashboardService) {}

  getSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.service.getSummary();
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const dashboardController = new DashboardController();
