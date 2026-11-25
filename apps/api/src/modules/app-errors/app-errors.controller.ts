import { Request, Response, NextFunction } from 'express';
import { appErrorsService, AppErrorsService } from './app-errors.service.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { ErrorStatus, ErrorSeverity } from '@prisma/client';

export class AppErrorsController {
  constructor(private service: AppErrorsService = appErrorsService) {}

  listErrors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const { status, severity } = req.query;

      const criteria = {
        status: status ? (String(status).toUpperCase() as ErrorStatus) : undefined,
        severity: severity ? (String(severity).toUpperCase() as ErrorSeverity) : undefined,
      };

      const result = await this.service.listErrors(criteria, pagination);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  resolveError = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await this.service.resolveError(
        id,
        status ? (String(status).toUpperCase() as ErrorStatus) : ErrorStatus.RESOLVED,
      );

      res.json({
        success: true,
        message: 'Error status updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const appErrorsController = new AppErrorsController();
