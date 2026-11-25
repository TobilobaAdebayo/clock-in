import { Request, Response, NextFunction } from 'express';
import { reportsService, ReportsService, ReportType, ReportFormat } from './reports.service.js';
import { env } from '../../config/env.js';

export class ReportsController {
  constructor(private service: ReportsService = reportsService) {}

  exportReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type, format, date, startDate, endDate, visitorId, status } = req.query;

      if (!type) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Report type is required (DAILY, WEEKLY, MONTHLY, CUSTOM, or VISITOR).',
          },
        });
        return;
      }

      const reportType = String(type).toUpperCase() as ReportType;
      const reportFormat = (format ? String(format).toUpperCase() : 'XLSX') as ReportFormat;

      if (reportFormat !== 'XLSX' && reportFormat !== 'PDF') {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Unsupported export format. Use xlsx or pdf.',
          },
        });
        return;
      }

      if (reportType === 'CUSTOM' && (!startDate || !endDate)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'startDate and endDate are required for CUSTOM report type.',
          },
        });
        return;
      }

      if (reportType === 'VISITOR' && !visitorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'visitorId is required for VISITOR report type.',
          },
        });
        return;
      }

      const { criteria, filename, title } = this.service.resolveCriteriaAndFilename(
        {
          type: reportType,
          format: reportFormat,
          date: date ? String(date) : undefined,
          startDate: startDate ? String(startDate) : undefined,
          endDate: endDate ? String(endDate) : undefined,
          visitorId: visitorId ? String(visitorId) : undefined,
          status: status ? (String(status) as any) : undefined,
        },
        env.WORKSPACE_TIMEZONE,
      );

      if (reportFormat === 'PDF') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await this.service.streamPdfReportToResponse(criteria, res, title, env.WORKSPACE_TIMEZONE);
      } else {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await this.service.streamReportToResponse(criteria, res, env.WORKSPACE_TIMEZONE);
      }
    } catch (error) {
      next(error);
    }
  };
}

export const reportsController = new ReportsController();
