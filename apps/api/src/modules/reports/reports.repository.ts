import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { AttendanceExportRow } from './excel.builder.js';

export interface ReportFilterCriteria {
  startDate?: Date;
  endDate?: Date;
  visitorId?: string;
  status?: 'ACTIVE' | 'CHECKED_OUT';
}

export class ReportsRepository {
  /**
   * Streams attendance records in batches to conserve memory and handle large exports safely (FR-15).
   */
  async streamBatches(
    criteria: ReportFilterCriteria,
    batchSize = 1000,
    maxRows = 50000,
    onBatch: (records: AttendanceExportRow[]) => Promise<void>,
  ): Promise<number> {
    const where: Prisma.AttendanceWhereInput = {};

    if (criteria.startDate || criteria.endDate) {
      where.checkIn = {};
      if (criteria.startDate) where.checkIn.gte = criteria.startDate;
      if (criteria.endDate) where.checkIn.lte = criteria.endDate;
    }

    if (criteria.visitorId) {
      where.visitorId = criteria.visitorId;
    }

    if (criteria.status === 'ACTIVE') {
      where.checkOut = null;
    } else if (criteria.status === 'CHECKED_OUT') {
      where.checkOut = { not: null };
    }

    let skip = 0;
    let totalExported = 0;

    while (totalExported < maxRows) {
      const take = Math.min(batchSize, maxRows - totalExported);

      const records = await prisma.attendance.findMany({
        where,
        skip,
        take,
        orderBy: { checkIn: 'desc' },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          visitor: {
            select: {
              fullName: true,
              phoneNumber: true,
            },
          },
        },
      });

      if (records.length === 0) {
        break;
      }

      await onBatch(records as AttendanceExportRow[]);

      totalExported += records.length;
      skip += records.length;

      if (records.length < take) {
        break;
      }
    }

    return totalExported;
  }
}

export const reportsRepository = new ReportsRepository();
