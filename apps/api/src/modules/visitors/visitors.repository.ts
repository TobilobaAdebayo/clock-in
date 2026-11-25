import { Visitor, Prisma, Attendance } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { getWeekBounds, getMonthBounds } from '../../shared/utils/time.js';

export class VisitorsRepository {
  async findByPhoneNumber(
    phoneNumber: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Visitor | null> {
    return tx.visitor.findUnique({
      where: { phoneNumber },
    });
  }

  async findById(id: string, tx: Prisma.TransactionClient = prisma): Promise<Visitor | null> {
    return tx.visitor.findUnique({
      where: { id },
    });
  }

  async create(
    data: {
      fullName: string;
      phoneNumber: string;
    },
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Visitor> {
    return tx.visitor.create({
      data: {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
      },
    });
  }

  /**
   * Paginated directory search matching partial name or phone number (FR-11).
   */
  async findManyPaginated(params: {
    skip: number;
    take: number;
    search?: string;
  }): Promise<[Visitor[], number]> {
    const { skip, take, search } = params;

    const where: Prisma.VisitorWhereInput = {};

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      where.OR = [
        {
          fullName: {
            contains: cleanSearch,
            mode: 'insensitive',
          },
        },
        {
          phoneNumber: {
            contains: cleanSearch,
          },
        },
      ];
    }

    return prisma.$transaction([
      prisma.visitor.findMany({
        where,
        skip,
        take,
        orderBy: {
          fullName: 'asc',
        },
      }),
      prisma.visitor.count({ where }),
    ]);
  }

  /**
   * Retrieves visit counts and current session status for a visitor profile (FR-12, FR-13).
   */
  async getVisitorStats(
    visitorId: string,
    timezone: string,
  ): Promise<{
    totalVisits: number;
    thisWeekVisits: number;
    thisMonthVisits: number;
    lastVisit: Attendance | null;
    activeSession: Attendance | null;
  }> {
    const week = getWeekBounds(new Date(), timezone);
    const month = getMonthBounds(new Date(), timezone);

    const [totalVisits, thisWeekVisits, thisMonthVisits, lastVisit, activeSession] =
      await Promise.all([
        prisma.attendance.count({
          where: { visitorId },
        }),
        prisma.attendance.count({
          where: {
            visitorId,
            checkIn: {
              gte: week.startOfWeek,
              lte: week.endOfWeek,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            visitorId,
            checkIn: {
              gte: month.startOfMonth,
              lte: month.endOfMonth,
            },
          },
        }),
        prisma.attendance.findFirst({
          where: { visitorId },
          orderBy: { checkIn: 'desc' },
        }),
        prisma.attendance.findFirst({
          where: {
            visitorId,
            checkOut: null,
          },
        }),
      ]);

    return {
      totalVisits,
      thisWeekVisits,
      thisMonthVisits,
      lastVisit,
      activeSession,
    };
  }

  /**
   * Retrieves paginated attendance history for an individual visitor (FR-12).
   */
  async findAttendanceHistoryPaginated(
    visitorId: string,
    skip: number,
    take: number,
  ): Promise<[Attendance[], number]> {
    return prisma.$transaction([
      prisma.attendance.findMany({
        where: { visitorId },
        skip,
        take,
        orderBy: { checkIn: 'desc' },
      }),
      prisma.attendance.count({
        where: { visitorId },
      }),
    ]);
  }
}

export const visitorsRepository = new VisitorsRepository();
