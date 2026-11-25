import { Request, Response, NextFunction } from 'express';
import { auditService, AuditService } from './audit.service.js';
import { parsePagination } from '../../shared/utils/pagination.js';

export class AuditController {
  constructor(private service: AuditService = auditService) {}

  listLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const { actorId, action, recordType, startDate, endDate } = req.query;

      const criteria = {
        actorId: actorId ? String(actorId) : undefined,
        action: action ? String(action) : undefined,
        recordType: recordType ? String(recordType) : undefined,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
      };

      const result = await this.service.listLogs(criteria, pagination);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const auditController = new AuditController();
