import { AppErrorsRepository, appErrorsRepository, AppErrorFilterCriteria } from './app-errors.repository.js';
import { ErrorSeverity, ErrorStatus, AppError as DbAppError } from '@prisma/client';
import { PaginationParams, createPaginatedResponse, PaginatedResult } from '../../shared/utils/pagination.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { redactSensitiveText } from '../../shared/utils/redact.js';

export class AppErrorsService {
  constructor(private repo: AppErrorsRepository = appErrorsRepository) { }

  /**
   * Captures an application error into the database without leaking sensitive payloads (FR-19).
   */
  async recordError(data: {
    errorType: string;
    message: string;
    severity?: ErrorSeverity;
    stack?: string;
  }): Promise<DbAppError | null> {
    try {
      // Redact passwords, tokens, hashes, DB URLs, and phone numbers before persisting
      const sanitizedMessage = redactSensitiveText(data.message);
      const sanitizedStack = data.stack ? redactSensitiveText(data.stack) : undefined;

      return await this.repo.create({
        errorType: data.errorType,
        message: sanitizedMessage,
        severity: data.severity,
        stack: sanitizedStack,
      });
    } catch (e) {
      console.error('Failed to write AppError to DB:', e instanceof Error ? redactSensitiveText(e.message) : 'unknown');
      return null;
    }
  }

  async listErrors(
    criteria: AppErrorFilterCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<DbAppError>> {
    const { errors, total } = await this.repo.findManyPaginated(criteria, pagination);
    return createPaginatedResponse(errors, total, pagination.page, pagination.limit);
  }

  async resolveError(id: string, status: ErrorStatus = ErrorStatus.RESOLVED): Promise<DbAppError> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError('App error entry not found.');
    }
    return this.repo.updateStatus(id, status);
  }
}

export const appErrorsService = new AppErrorsService();
