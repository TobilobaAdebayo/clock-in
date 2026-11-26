import { visitorsRepository, VisitorsRepository } from './visitors.repository.js';
import { attendanceService } from '../attendance/attendance.service.js';
import { normalizePhoneNumber, maskPhoneNumber, maskName } from '../../shared/utils/phone.js';
import { signLookupToken, verifyLookupToken, hmacDigest, safeCompare } from '../../shared/utils/crypto.js';
import { parsePagination, createPaginatedResponse } from '../../shared/utils/pagination.js';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../shared/errors/app-error.js';

export interface RegisterVisitorDto {
  fullName: string;
  phoneNumber?: string | null;
  hostName?: string;
}

const looksLikePhoneNumber = (input: string): boolean => {
  const trimmed = input.trim();
  if (!/^[+\d\s\-().]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

export class VisitorsService {
  constructor(private repo: VisitorsRepository = visitorsRepository) {}

  /**
   * Registers a new visitor (phone number optional) and immediately creates their initial check-in session (FR-01, FR-04).
   */
  async register(data: RegisterVisitorDto) {
    const cleanName = data.fullName.trim();
    const rawPhone = data.phoneNumber?.trim();
    let normalizedPhone: string | null = null;

    if (rawPhone) {
      normalizedPhone = normalizePhoneNumber(rawPhone);
      const existingVisitor = await this.repo.findByPhoneNumber(normalizedPhone);
      if (existingVisitor) {
        throw new ConflictError(
          'A visitor with this phone number is already registered. Please proceed to returning visitor check-in.',
        );
      }
    } else {
      const sameNameVisitors = await this.repo.findByFullName(cleanName);
      if (sameNameVisitors.some((v) => !v.phoneNumber)) {
        throw new ConflictError(
          'A visitor with this name is already registered. Please proceed to returning visitor check-in.',
        );
      }
    }

    const visitor = await this.repo.create({
      fullName: cleanName,
      phoneNumber: normalizedPhone,
    });

    const attendance = await attendanceService.checkIn(visitor.id, data.hostName);

    return {
      visitor: {
        id: visitor.id,
        fullName: visitor.fullName,
        phoneNumber: visitor.phoneNumber,
      },
      attendance: {
        id: attendance.id,
        hostName: attendance.hostName,
        checkIn: attendance.checkIn,
        status: 'CHECKED_IN',
      },
    };
  }

  private async buildLookupCandidate(
    visitor: { id: string; fullName: string; phoneNumber: string | null },
    matchedBy: 'phone' | 'name',
  ) {
    const activeSession = await attendanceService.getActiveSession(visitor.id);

    // Privacy: never store plaintext fullName or phoneNumber inside the base64url lookupToken.
    const nameDigest = hmacDigest(
      visitor.fullName.trim().toLowerCase(),
      env.JWT_ACCESS_SECRET,
    );

    const lookupToken = signLookupToken(
      {
        visitorId: visitor.id,
        nameDigest,
      },
      env.JWT_ACCESS_SECRET,
      300,
    );

    // If visitor is already signed in, issue a scoped check-out-only token so they can
    // sign out directly without an extra confirmation step.
    const checkOutToken = activeSession
      ? signLookupToken(
          {
            visitorId: visitor.id,
            confirmed: true,
            scope: 'CHECK_OUT_ONLY',
          },
          env.JWT_ACCESS_SECRET,
          300,
        )
      : null;

    return {
      lookupToken,
      checkOutToken,
      matchedBy,
      maskedName: maskName(visitor.fullName),
      maskedPhone: visitor.phoneNumber ? maskPhoneNumber(visitor.phoneNumber) : 'Not provided',
      hasActiveSession: Boolean(activeSession),
      activeSession: activeSession
        ? {
            id: activeSession.id,
            checkIn: activeSession.checkIn,
          }
        : null,
    };
  }

  /**
   * Looks up returning visitor by phone number OR full name (for visitors registered with or without a phone number).
   * When multiple profiles share the same name, returns masked candidates so the visitor can select theirs safely.
   */
  async lookup(identifier: string) {
    const trimmed = identifier.trim();

    if (looksLikePhoneNumber(trimmed)) {
      const normalizedPhone = normalizePhoneNumber(trimmed);
      const visitor = await this.repo.findByPhoneNumber(normalizedPhone);
      if (!visitor) {
        throw new NotFoundError(
          'No registered visitor found with this phone number. Please register as a new visitor.',
        );
      }

      return {
        multipleMatches: false as const,
        ...(await this.buildLookupCandidate(visitor, 'phone')),
      };
    }

    const matches = await this.repo.findByFullName(trimmed);
    if (matches.length === 0) {
      throw new NotFoundError(
        'No registered visitor found with this name. Please check the spelling or register as a new visitor.',
      );
    }

    if (matches.length === 1) {
      return {
        multipleMatches: false as const,
        ...(await this.buildLookupCandidate(matches[0], 'name')),
      };
    }

    const candidates = await Promise.all(
      matches.slice(0, 10).map((v) => this.buildLookupCandidate(v, 'name')),
    );

    return {
      multipleMatches: true as const,
      matchedBy: 'name' as const,
      matches: candidates,
    };
  }

  /**
   * Confirms visitor identity by validating confirmation name against the signed token's HMAC digest.
   */
  async confirm(lookupToken: string, confirmationAnswer: string) {
    const payload = verifyLookupToken<{
      visitorId: string;
      nameDigest: string;
    }>(lookupToken, env.JWT_ACCESS_SECRET);

    if (!payload || !payload.visitorId || !payload.nameDigest) {
      throw new BadRequestError('Invalid or expired lookup session. Please search your phone number or full name again.');
    }

    const answerDigest = hmacDigest(
      confirmationAnswer.trim().toLowerCase(),
      env.JWT_ACCESS_SECRET,
    );
    const isNameMatch = safeCompare(payload.nameDigest, answerDigest);

    if (!isNameMatch) {
      throw new BadRequestError('Confirmation name does not match the registered record. Please try again.');
    }

    const activeSession = await attendanceService.getActiveSession(payload.visitorId);

    const actionToken = signLookupToken(
      {
        visitorId: payload.visitorId,
        confirmed: true,
      },
      env.JWT_ACCESS_SECRET,
      300,
    );

    return {
      actionToken,
      visitorId: payload.visitorId,
      fullName: confirmationAnswer.trim(),
      hasActiveSession: Boolean(activeSession),
      activeSession: activeSession
        ? {
            id: activeSession.id,
            checkIn: activeSession.checkIn,
          }
        : null,
    };
  }

  /**
   * Staff directory listing with debounced partial search by name/phone and session status filter (FR-11).
   */
  async listVisitors(query: Record<string, unknown>) {
    const pagination = parsePagination(query, 10, 100);
    const search = typeof query.search === 'string' ? query.search : undefined;
    const status =
      query.status === 'ACTIVE' || query.status === 'CHECKED_OUT'
        ? (query.status as 'ACTIVE' | 'CHECKED_OUT')
        : undefined;

    const [visitors, total] = await this.repo.findManyPaginated({
      skip: pagination.skip,
      take: pagination.take,
      search,
      status,
    });

    const formatted = visitors.map((v) => {
      const { attendances, ...rest } = v as typeof v & {
        attendances?: Array<{ id: string; checkIn: Date; hostName: string | null }>;
      };
      const activeSession = Array.isArray(attendances) && attendances.length > 0 ? attendances[0] : null;
      return {
        ...rest,
        hasActiveSession: Boolean(activeSession),
        activeSession,
      };
    });

    return createPaginatedResponse(formatted, total, pagination.page, pagination.limit);
  }

  /**
   * Staff visitor profile view with calculated weekly and monthly visit counts (FR-12, FR-13).
   */
  async getVisitorProfile(visitorId: string, timezone = env.WORKSPACE_TIMEZONE) {
    const visitor = await this.repo.findById(visitorId);
    if (!visitor) {
      throw new NotFoundError('Visitor profile not found.');
    }

    const stats = await this.repo.getVisitorStats(visitorId, timezone);

    return {
      visitor: {
        id: visitor.id,
        fullName: visitor.fullName,
        phoneNumber: visitor.phoneNumber,
        createdAt: visitor.createdAt,
      },
      stats: {
        totalVisits: stats.totalVisits,
        thisWeekVisits: stats.thisWeekVisits,
        thisMonthVisits: stats.thisMonthVisits,
        lastVisitDate: stats.lastVisit ? stats.lastVisit.checkIn : null,
        currentlyCheckedIn: stats.activeSession !== null,
        activeSession: stats.activeSession
          ? {
              id: stats.activeSession.id,
              checkIn: stats.activeSession.checkIn,
            }
          : null,
      },
    };
  }

  /**
   * Staff visitor historical attendance records (FR-12).
   */
  async getVisitorAttendanceHistory(visitorId: string, query: Record<string, unknown>) {
    const visitor = await this.repo.findById(visitorId);
    if (!visitor) {
      throw new NotFoundError('Visitor not found.');
    }

    const pagination = parsePagination(query, 10, 100);
    const [attendances, total] = await this.repo.findAttendanceHistoryPaginated(
      visitorId,
      pagination.skip,
      pagination.take,
    );

    return createPaginatedResponse(attendances, total, pagination.page, pagination.limit);
  }
}

export const visitorsService = new VisitorsService();
