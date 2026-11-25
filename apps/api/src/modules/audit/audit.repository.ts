import { Prisma, AuditLog } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { PaginationParams } from '../../shared/utils/pagination.js';

export interface AuditLogFilterCriteria {
  actorId?: string;
  action?: string;
  recordType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateAuditLogData {
  actorId: string;
  action: string;
  recordType: string;
  recordId: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

export class AuditRepository {
  async create(data: CreateAuditLogData, tx: Prisma.TransactionClient = prisma): Promise<AuditLog> {
    return tx.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        recordType: data.recordType,
        recordId: data.recordId,
        oldValues: data.oldValues ?? Prisma.DbNull,
        newValues: data.newValues ?? Prisma.DbNull,
      },
    });
  }

  async findManyPaginated(
    criteria: AuditLogFilterCriteria,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<{ logs: (AuditLog & { actor: { id: string; fullName: string; email: string; role: string } })[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (criteria.actorId) {
      where.actorId = criteria.actorId;
    }
    if (criteria.action) {
      where.action = criteria.action;
    }
    if (criteria.recordType) {
      where.recordType = criteria.recordType;
    }
    if (criteria.startDate || criteria.endDate) {
      where.createdAt = {};
      if (criteria.startDate) where.createdAt.gte = criteria.startDate;
      if (criteria.endDate) where.createdAt.lte = criteria.endDate;
    }

    const [logs, total] = await Promise.all([
      tx.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      tx.auditLog.count({ where }),
    ]);

    return { logs: logs as any, total };
  }
}

export const auditRepository = new AuditRepository();
