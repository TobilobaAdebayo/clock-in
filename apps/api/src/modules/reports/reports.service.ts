import { Stream } from 'node:stream';
import { reportsRepository, ReportsRepository, ReportFilterCriteria } from './reports.repository.js';
import { ExcelReportBuilder, AttendanceExportRow } from './excel.builder.js';
import { PdfReportBuilder } from './pdf.builder.js';
import { getDayBounds, getWeekBounds, getMonthBounds } from '../../shared/utils/time.js';
import { env } from '../../config/env.js';
import { BadRequestError } from '../../shared/errors/app-error.js';

export type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' | 'VISITOR';
export type ReportFormat = 'XLSX' | 'PDF';

export interface GenerateReportParams {
  type: ReportType;
  format?: ReportFormat;
  date?: string;
  startDate?: string;
  endDate?: string;
  visitorId?: string;
  status?: 'ACTIVE' | 'CHECKED_OUT';
}

export class ReportsService {
  constructor(private repo: ReportsRepository = reportsRepository) {}

  /**
   * Generates a streaming Excel report directly to an output stream (FR-15).
   */
  async streamReportToResponse(
    criteria: ReportFilterCriteria,
    outputStream: Stream.Writable,
    timezone = env.WORKSPACE_TIMEZONE,
  ): Promise<number> {
    const { workbook, worksheet } = ExcelReportBuilder.createStreamingWorkbook(outputStream);

    let serialNumber = 1;

    const rowCount = await this.repo.streamBatches(criteria, 1000, 50000, async (batch) => {
      for (const record of batch) {
        ExcelReportBuilder.addRow(worksheet, record, serialNumber, timezone);
        serialNumber++;
      }
    });

    await workbook.commit();

    return rowCount;
  }

  /**
   * Generates a formatted PDF attendance report directly to an output stream.
   */
  async streamPdfReportToResponse(
    criteria: ReportFilterCriteria,
    outputStream: Stream.Writable,
    title: string,
    timezone = env.WORKSPACE_TIMEZONE,
  ): Promise<number> {
    const collected: AttendanceExportRow[] = [];

    const rowCount = await this.repo.streamBatches(criteria, 1000, 10000, async (batch) => {
      collected.push(...batch);
    });

    await PdfReportBuilder.renderToStream(collected, outputStream, { title, timezone });
    return rowCount;
  }

  /**
   * Resolves query parameters into precise date boundaries, title, and formatted filename.
   */
  resolveCriteriaAndFilename(
    params: GenerateReportParams,
    timezone: string,
  ): { criteria: ReportFilterCriteria; filename: string; title: string } {
    const format: ReportFormat = params.format || 'XLSX';
    const ext = format === 'PDF' ? 'pdf' : 'xlsx';

    const criteria: ReportFilterCriteria = {
      status: params.status,
      visitorId: params.visitorId,
    };

    const refDate = params.date ? new Date(params.date) : new Date();

    switch (params.type) {
      case 'DAILY': {
        const bounds = getDayBounds(refDate, timezone);
        criteria.startDate = bounds.startOfDay;
        criteria.endDate = bounds.endOfDay;
        const dateStr = refDate.toISOString().slice(0, 10);
        return {
          criteria,
          filename: `attendance_daily_${dateStr}.${ext}`,
          title: `Daily Attendance Report (${dateStr})`,
        };
      }

      case 'WEEKLY': {
        const bounds = getWeekBounds(refDate, timezone);
        criteria.startDate = bounds.startOfWeek;
        criteria.endDate = bounds.endOfWeek;
        const startStr = bounds.startOfWeek.toISOString().slice(0, 10);
        const endStr = bounds.endOfWeek.toISOString().slice(0, 10);
        return {
          criteria,
          filename: `attendance_weekly_${startStr}_to_${endStr}.${ext}`,
          title: `Weekly Attendance Report (${startStr} to ${endStr})`,
        };
      }

      case 'MONTHLY': {
        const bounds = getMonthBounds(refDate, timezone);
        criteria.startDate = bounds.startOfMonth;
        criteria.endDate = bounds.endOfMonth;
        const monthStr = refDate.toISOString().slice(0, 7);
        return {
          criteria,
          filename: `attendance_monthly_${monthStr}.${ext}`,
          title: `Monthly Attendance Report (${monthStr})`,
        };
      }

      case 'CUSTOM': {
        if (!params.startDate || !params.endDate) {
          throw new BadRequestError('startDate and endDate are required for CUSTOM report type.');
        }
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new BadRequestError('Invalid date format for custom date range.');
        }
        criteria.startDate = start;
        criteria.endDate = end;
        const s = params.startDate.slice(0, 10);
        const e = params.endDate.slice(0, 10);
        return {
          criteria,
          filename: `attendance_custom_${s}_to_${e}.${ext}`,
          title: `Attendance Report (${s} to ${e})`,
        };
      }

      case 'VISITOR': {
        if (!params.visitorId) {
          throw new BadRequestError('visitorId is required for VISITOR report type.');
        }
        criteria.visitorId = params.visitorId;
        return {
          criteria,
          filename: `attendance_visitor_${params.visitorId.slice(0, 8)}.${ext}`,
          title: `Visitor Attendance History`,
        };
      }

      default:
        throw new BadRequestError(`Unsupported report type: ${params.type}`);
    }
  }
}

export const reportsService = new ReportsService();
