import { Prisma, AuditLog } from '@prisma/client';
import { auditRepository, AuditRepository, CreateAuditLogData, AuditLogFilterCriteria } from './audit.repository.js';
import { PaginationParams, createPaginatedResponse, PaginatedResult } from '../../shared/utils/pagination.js';

export class AuditService {
  constructor(private repo: AuditRepository = auditRepository) {}

  /**
   * Records an audit log entry atomically within a transaction (FR-17).
   */
  async record(data: CreateAuditLogData, tx?: Prisma.TransactionClient): Promise<AuditLog> {
    return this.repo.create(data, tx);
  }

  /**
   * Retrieves paginated audit logs with actor and time filters (FR-18).
   */
  async listLogs(
    criteria: AuditLogFilterCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<any>> {
    const { logs, total } = await this.repo.findManyPaginated(criteria, pagination);
    return createPaginatedResponse(logs, total, pagination.page, pagination.limit);
  }
}

export const auditService = new AuditService();
