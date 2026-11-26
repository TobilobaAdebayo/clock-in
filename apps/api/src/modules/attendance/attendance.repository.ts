import { Attendance, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export class AttendanceRepository {
  async findActiveByVisitorId(
    visitorId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Attendance | null> {
    return tx.attendance.findFirst({
      where: {
        visitorId,
        checkOut: null,
      },
    });
  }

  async findById(id: string, tx: Prisma.TransactionClient = prisma): Promise<Attendance | null> {
    return tx.attendance.findUnique({
      where: { id },
    });
  }

  async create(
    visitorId: string,
    tx: Prisma.TransactionClient = prisma,
    hostName?: string | null,
  ): Promise<Attendance> {
    const cleanHost = hostName?.trim() || null;
    return tx.attendance.create({
      data: {
        visitorId,
        hostName: cleanHost,
        checkIn: new Date(),
        checkOut: null,
      },
    });
  }

  async closeSession(
    id: string,
    checkOutTime = new Date(),
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Attendance> {
    return tx.attendance.update({
      where: { id },
      data: {
        checkOut: checkOutTime,
      },
    });
  }

  async updateAttendance(
    id: string,
    data: { checkIn?: Date; checkOut?: Date | null },
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Attendance> {
    return tx.attendance.update({
      where: { id },
      data,
    });
  }

  /**
   * Paginated and filtered attendance query (FR-14).
   */
  async findManyFiltered(params: {
    skip: number;
    take: number;
    startDate?: Date;
    endDate?: Date;
    status?: 'ACTIVE' | 'CHECKED_OUT';
    search?: string;
  }): Promise<[any[], number]> {
    const { skip, take, startDate, endDate, status, search } = params;

    const where: Prisma.AttendanceWhereInput = {};

    // Date range filter
    if (startDate || endDate) {
      where.checkIn = {};
      if (startDate) where.checkIn.gte = startDate;
      if (endDate) where.checkIn.lte = endDate;
    }

    // Status filter
    if (status === 'ACTIVE') {
      where.checkOut = null;
    } else if (status === 'CHECKED_OUT') {
      where.checkOut = { not: null };
    }

    // Visitor search filter (name, phone, or who they came to see)
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      where.OR = [
        { visitor: { fullName: { contains: cleanSearch, mode: 'insensitive' } } },
        { visitor: { phoneNumber: { contains: cleanSearch } } },
        { hostName: { contains: cleanSearch, mode: 'insensitive' } },
      ];
    }

    return prisma.$transaction([
      prisma.attendance.findMany({
        where,
        skip,
        take,
        orderBy: { checkIn: 'desc' },
        include: {
          visitor: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);
  }

  /**
   * Returns all currently active visitors in the space (scoped to today when `since` is supplied) (FR-10).
   */
  async findActiveSessions(since?: Date): Promise<any[]> {
    return prisma.attendance.findMany({
      where: {
        checkOut: null,
        ...(since ? { checkIn: { gte: since } } : {}),
      },
      orderBy: { checkIn: 'desc' },
      include: {
        visitor: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });
  }
}

export const attendanceRepository = new AttendanceRepository();
