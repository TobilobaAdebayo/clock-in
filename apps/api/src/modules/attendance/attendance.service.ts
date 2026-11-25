import { Attendance, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { attendanceRepository, AttendanceRepository } from './attendance.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import { parsePagination, createPaginatedResponse } from '../../shared/utils/pagination.js';
import { ConflictError, BadRequestError, NotFoundError } from '../../shared/errors/app-error.js';

export class AttendanceService {
  constructor(
    private repo: AttendanceRepository = attendanceRepository,
    private audit: AuditService = auditService,
  ) {}

  /**
   * Checks in a visitor with server-generated timestamp.
   * Enforces the active session rule (FR-04, FR-06) within a transaction.
   */
  async checkIn(visitorId: string): Promise<Attendance> {
    try {
      return await prisma.$transaction(async (tx) => {
        const existingActive = await this.repo.findActiveByVisitorId(visitorId, tx);
        if (existingActive) {
          throw new ConflictError(
            'Visitor is already checked in with an active visit session.',
            { activeSessionId: existingActive.id, checkIn: existingActive.checkIn },
          );
        }

        return await this.repo.create(visitorId, tx);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Visitor is already checked in with an active visit session.');
      }
      throw error;
    }
  }

  /**
   * Checks out a visitor from their open session with server-generated timestamp (FR-05).
   */
  async checkOut(visitorId: string): Promise<Attendance> {
    return prisma.$transaction(async (tx) => {
      const activeSession = await this.repo.findActiveByVisitorId(visitorId, tx);
      if (!activeSession) {
        throw new BadRequestError('No active visit session found. You are not currently checked in.');
      }

      return await this.repo.closeSession(activeSession.id, new Date(), tx);
    });
  }

  /**
   * Checks whether a visitor currently has an open attendance session.
   */
  async hasActiveSession(visitorId: string): Promise<boolean> {
    const session = await this.repo.findActiveByVisitorId(visitorId);
    return session !== null;
  }

  /**
   * Gets current active session for visitor, if any.
   */
  async getActiveSession(visitorId: string): Promise<Attendance | null> {
    return this.repo.findActiveByVisitorId(visitorId);
  }

  /**
   * Filtered and paginated attendance records (FR-14).
   */
  async listFiltered(query: Record<string, unknown>) {
    const pagination = parsePagination(query, 10, 100);

    const startDate = query.startDate ? new Date(String(query.startDate)) : undefined;
    const endDate = query.endDate ? new Date(String(query.endDate)) : undefined;
    const status =
      query.status === 'ACTIVE' || query.status === 'CHECKED_OUT'
        ? (query.status as 'ACTIVE' | 'CHECKED_OUT')
        : undefined;
    const search = typeof query.search === 'string' ? query.search : undefined;

    const [attendances, total] = await this.repo.findManyFiltered({
      skip: pagination.skip,
      take: pagination.take,
      startDate,
      endDate,
      status,
      search,
    });

    return createPaginatedResponse(attendances, total, pagination.page, pagination.limit);
  }

  /**
   * Corrects check-in/check-out timestamp with mandatory reason and audit record (FR-17).
   */
  async correctAttendance(
    id: string,
    input: { checkIn?: string; checkOut?: string | null; reason: string },
    actorId: string,
  ): Promise<Attendance> {
    if (!input.reason || input.reason.trim().length < 5) {
      throw new BadRequestError('A valid correction reason of at least 5 characters is required.');
    }

    return prisma.$transaction(async (tx) => {
      const existing = await this.repo.findById(id, tx);
      if (!existing) {
        throw new NotFoundError('Attendance record not found.');
      }

      const newCheckIn = input.checkIn ? new Date(input.checkIn) : existing.checkIn;
      let newCheckOut: Date | null = existing.checkOut;
      if (input.checkOut !== undefined) {
        newCheckOut = input.checkOut ? new Date(input.checkOut) : null;
      }

      if (isNaN(newCheckIn.getTime())) {
        throw new BadRequestError('Invalid checkIn date format.');
      }

      if (newCheckOut && isNaN(newCheckOut.getTime())) {
        throw new BadRequestError('Invalid checkOut date format.');
      }

      if (newCheckOut && newCheckOut <= newCheckIn) {
        throw new BadRequestError('Check-out timestamp must be after check-in timestamp.');
      }

      if (newCheckOut === null) {
        const active = await this.repo.findActiveByVisitorId(existing.visitorId, tx);
        if (active && active.id !== id) {
          throw new ConflictError('Visitor already has another open active session.');
        }
      }

      const updated = await this.repo.updateAttendance(
        id,
        {
          checkIn: newCheckIn,
          checkOut: newCheckOut,
        },
        tx,
      );

      await this.audit.record(
        {
          actorId,
          action: 'ATTENDANCE_CORRECTION',
          recordType: 'ATTENDANCE',
          recordId: id,
          oldValues: {
            checkIn: existing.checkIn.toISOString(),
            checkOut: existing.checkOut ? existing.checkOut.toISOString() : null,
          },
          newValues: {
            checkIn: updated.checkIn.toISOString(),
            checkOut: updated.checkOut ? updated.checkOut.toISOString() : null,
            reason: input.reason.trim(),
          },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Lists all currently checked-in visitors in the workspace (FR-10).
   */
  async getActiveSessions() {
    return this.repo.findActiveSessions();
  }
}

export const attendanceService = new AttendanceService();
