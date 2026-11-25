import { AppError as DbAppError, ErrorSeverity, ErrorStatus, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { PaginationParams } from '../../shared/utils/pagination.js';

export interface AppErrorFilterCriteria {
  status?: ErrorStatus;
  severity?: ErrorSeverity;
}

export class AppErrorsRepository {
  async create(data: {
    errorType: string;
    message: string;
    severity?: ErrorSeverity;
    stack?: string;
  }): Promise<DbAppError> {
    return prisma.appError.create({
      data: {
        errorType: data.errorType,
        message: data.message,
        severity: data.severity ?? ErrorSeverity.MEDIUM,
        status: ErrorStatus.OPEN,
        stack: data.stack,
      },
    });
  }

  async findById(id: string): Promise<DbAppError | null> {
    return prisma.appError.findUnique({
      where: { id },
    });
  }

  async updateStatus(id: string, status: ErrorStatus): Promise<DbAppError> {
    return prisma.appError.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === ErrorStatus.RESOLVED ? new Date() : null,
      },
    });
  }

  async findManyPaginated(
    criteria: AppErrorFilterCriteria,
    pagination: PaginationParams,
  ): Promise<{ errors: DbAppError[]; total: number }> {
    const where: Prisma.AppErrorWhereInput = {};

    if (criteria.status) {
      where.status = criteria.status;
    }
    if (criteria.severity) {
      where.severity = criteria.severity;
    }

    const [errors, total] = await Promise.all([
      prisma.appError.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.appError.count({ where }),
    ]);

    return { errors, total };
  }
}

export const appErrorsRepository = new AppErrorsRepository();
