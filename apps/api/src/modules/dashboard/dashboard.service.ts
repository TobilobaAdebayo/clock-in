import { prisma } from '../../shared/db/prisma.js';
import { getDayBounds, getWeekBounds, getMonthBounds } from '../../shared/utils/time.js';
import { env } from '../../config/env.js';

export interface DashboardSummary {
  workspace: {
    name: string;
    timezone: string;
  };
  metrics: {
    todayVisits: number;
    currentlyCheckedIn: number;
    thisWeekVisits: number;
    thisMonthVisits: number;
  };
  todayBounds: {
    start: Date;
    end: Date;
  };
  recentCheckIns: Array<{
    id: string;
    hostName: string | null;
    checkIn: Date;
    checkOut: Date | null;
    visitor: {
      id: string;
      fullName: string;
      phoneNumber: string | null;
    };
  }>;
}

export class DashboardService {
  async getSummary(timezone = env.WORKSPACE_TIMEZONE): Promise<DashboardSummary> {
    const today = getDayBounds(new Date(), timezone);
    const week = getWeekBounds(new Date(), timezone);
    const month = getMonthBounds(new Date(), timezone);

    const [todayVisits, currentlyCheckedIn, thisWeekVisits, thisMonthVisits, recentCheckIns] =
      await Promise.all([
        // Total visits today
        prisma.attendance.count({
          where: {
            checkIn: {
              gte: today.startOfDay,
              lte: today.endOfDay,
            },
          },
        }),

        // Currently open sessions for today (previous-day forgotten sign-outs do not carry over)
        prisma.attendance.count({
          where: {
            checkOut: null,
            checkIn: {
              gte: today.startOfDay,
            },
          },
        }),

        // Total visits this week
        prisma.attendance.count({
          where: {
            checkIn: {
              gte: week.startOfWeek,
              lte: week.endOfWeek,
            },
          },
        }),

        // Total visits this month
        prisma.attendance.count({
          where: {
            checkIn: {
              gte: month.startOfMonth,
              lte: month.endOfMonth,
            },
          },
        }),

        // 5 most recent check-ins today
        prisma.attendance.findMany({
          where: {
            checkIn: {
              gte: today.startOfDay,
            },
          },
          orderBy: {
            checkIn: 'desc',
          },
          take: 5,
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
      ]);

    return {
      workspace: {
        name: env.WORKSPACE_NAME,
        timezone,
      },
      metrics: {
        todayVisits,
        currentlyCheckedIn,
        thisWeekVisits,
        thisMonthVisits,
      },
      todayBounds: {
        start: today.startOfDay,
        end: today.endOfDay,
      },
      recentCheckIns,
    };
  }
}

export const dashboardService = new DashboardService();
