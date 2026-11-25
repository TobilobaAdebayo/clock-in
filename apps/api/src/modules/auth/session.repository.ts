import { RefreshSession, Staff, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export class SessionRepository {
  async createSession(
    data: {
      staffId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx: Prisma.TransactionClient = prisma,
  ): Promise<RefreshSession> {
    return tx.refreshSession.create({
      data,
    });
  }

  async findActiveByTokenHash(
    tokenHash: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<(RefreshSession & { staff: Staff }) | null> {
    return tx.refreshSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        staff: true,
      },
    });
  }

  async revokeSession(id: string, tx: Prisma.TransactionClient = prisma): Promise<RefreshSession> {
    return tx.refreshSession.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllForStaff(
    staffId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Prisma.BatchPayload> {
    return tx.refreshSession.updateMany({
      where: {
        staffId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}

export const sessionRepository = new SessionRepository();
