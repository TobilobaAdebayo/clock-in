import { Staff, Role, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { PaginationParams } from '../../shared/utils/pagination.js';

export interface StaffFilterCriteria {
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export class StaffRepository {
  async findByEmail(email: string, tx: Prisma.TransactionClient = prisma): Promise<Staff | null> {
    return tx.staff.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string, tx: Prisma.TransactionClient = prisma): Promise<Staff | null> {
    return tx.staff.findUnique({
      where: { id },
    });
  }

  async countActiveSuperAdmins(tx: Prisma.TransactionClient = prisma): Promise<number> {
    return tx.staff.count({
      where: {
        role: Role.SUPER_ADMIN,
        isActive: true,
      },
    });
  }

  async create(
    data: {
      fullName: string;
      email: string;
      passwordHash: string;
      role: Role;
      isActive?: boolean;
    },
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Staff> {
    return tx.staff.create({
      data: {
        ...data,
        email: data.email.toLowerCase().trim(),
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    id: string,
    data: Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>>,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Staff> {
    return tx.staff.update({
      where: { id },
      data,
    });
  }

  async findAll(tx: Prisma.TransactionClient = prisma): Promise<Staff[]> {
    return tx.staff.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findManyPaginated(
    criteria: StaffFilterCriteria,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<{ staff: Staff[]; total: number }> {
    const where: Prisma.StaffWhereInput = {};

    if (criteria.role) {
      where.role = criteria.role;
    }
    if (criteria.isActive !== undefined) {
      where.isActive = criteria.isActive;
    }
    if (criteria.search) {
      where.OR = [
        { fullName: { contains: criteria.search, mode: 'insensitive' } },
        { email: { contains: criteria.search, mode: 'insensitive' } },
      ];
    }

    const [staff, total] = await Promise.all([
      tx.staff.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      tx.staff.count({ where }),
    ]);

    return { staff, total };
  }
}

export const staffRepository = new StaffRepository();
