import { Prisma, TwoFactorChallenge, TwoFactorPurpose } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export class TwoFactorRepository {
  async invalidatePendingForStaff(
    staffId: string,
    purpose?: TwoFactorPurpose,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<void> {
    await tx.twoFactorChallenge.updateMany({
      where: {
        staffId,
        ...(purpose ? { purpose } : {}),
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  async createChallenge(
    data: {
      id: string;
      staffId: string;
      purpose: TwoFactorPurpose;
      codeHash: string;
      expiresAt: Date;
    },
    tx: Prisma.TransactionClient = prisma,
  ): Promise<TwoFactorChallenge> {
    return tx.twoFactorChallenge.create({ data });
  }

  async findById(
    id: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<TwoFactorChallenge | null> {
    return tx.twoFactorChallenge.findUnique({ where: { id } });
  }

  async incrementAttempts(
    id: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<TwoFactorChallenge> {
    return tx.twoFactorChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async markConsumed(
    id: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<TwoFactorChallenge> {
    return tx.twoFactorChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}

export const twoFactorRepository = new TwoFactorRepository();
