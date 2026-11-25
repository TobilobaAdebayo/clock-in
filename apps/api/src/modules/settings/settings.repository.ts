import { Setting, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export class SettingsRepository {
  async get(key: string, tx: Prisma.TransactionClient = prisma): Promise<Setting | null> {
    return tx.setting.findUnique({
      where: { key },
    });
  }

  async getAll(tx: Prisma.TransactionClient = prisma): Promise<Setting[]> {
    return tx.setting.findMany();
  }

  async set(key: string, value: string, tx: Prisma.TransactionClient = prisma): Promise<Setting> {
    return tx.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

export const settingsRepository = new SettingsRepository();
