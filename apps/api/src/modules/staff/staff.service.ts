import { Staff, Role } from '@prisma/client';
import { staffRepository, StaffRepository, StaffFilterCriteria } from './staff.repository.js';
import { sessionRepository, SessionRepository } from '../auth/session.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/crypto.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../shared/errors/app-error.js';
import { PaginationParams, createPaginatedResponse, PaginatedResult } from '../../shared/utils/pagination.js';

export interface CreateStaffInput {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  isActive?: boolean;
}

export interface UpdateStaffInput {
  fullName?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

export class StaffService {
  constructor(
    private staffRepo: StaffRepository = staffRepository,
    private sessionRepo: SessionRepository = sessionRepository,
    private audit: AuditService = auditService,
  ) {}

  async listStaff(
    criteria: StaffFilterCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Omit<Staff, 'passwordHash'>>> {
    const { staff, total } = await this.staffRepo.findManyPaginated(criteria, pagination);
    const sanitized = staff.map(({ passwordHash: _, ...rest }) => rest);
    return createPaginatedResponse(sanitized, total, pagination.page, pagination.limit);
  }

  async getStaffById(id: string): Promise<Omit<Staff, 'passwordHash'>> {
    const staff = await this.staffRepo.findById(id);
    if (!staff) {
      throw new NotFoundError('Staff account not found.');
    }
    const { passwordHash: _, ...sanitized } = staff;
    return sanitized;
  }

  async createStaff(
    input: CreateStaffInput,
    actorId: string,
  ): Promise<Omit<Staff, 'passwordHash'>> {
    const existing = await this.staffRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('A staff member with this email already exists.');
    }

    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      const newStaff = await this.staffRepo.create(
        {
          fullName: input.fullName.trim(),
          email: input.email.trim(),
          passwordHash,
          role: input.role,
          isActive: input.isActive ?? true,
        },
        tx,
      );

      await this.audit.record(
        {
          actorId,
          action: 'CREATE_STAFF',
          recordType: 'STAFF',
          recordId: newStaff.id,
          newValues: {
            fullName: newStaff.fullName,
            email: newStaff.email,
            role: newStaff.role,
            isActive: newStaff.isActive,
          },
        },
        tx,
      );

      const { passwordHash: _, ...sanitized } = newStaff;
      return sanitized;
    });
  }

  async updateStaff(
    id: string,
    input: UpdateStaffInput,
    actorId: string,
  ): Promise<Omit<Staff, 'passwordHash'>> {
    const existing = await this.staffRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Staff account not found.');
    }

    if (input.email && input.email.toLowerCase().trim() !== existing.email.toLowerCase()) {
      const conflict = await this.staffRepo.findByEmail(input.email);
      if (conflict && conflict.id !== id) {
        throw new ConflictError('A staff member with this email already exists.');
      }
    }

    return prisma.$transaction(async (tx) => {
      // Guard: Cannot deactivate or demote the last active Super Admin (FR-16)
      const isDemotingOrDeactivating =
        existing.role === Role.SUPER_ADMIN &&
        ((input.role && input.role !== Role.SUPER_ADMIN) || input.isActive === false);

      if (isDemotingOrDeactivating) {
        const activeAdminsCount = await this.staffRepo.countActiveSuperAdmins(tx);
        if (activeAdminsCount <= 1) {
          throw new BadRequestError('Cannot deactivate or demote the last active Super Admin.');
        }
      }

      const updateData: Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>> = {};
      if (input.fullName !== undefined) updateData.fullName = input.fullName.trim();
      if (input.email !== undefined) updateData.email = input.email.toLowerCase().trim();
      if (input.role !== undefined) updateData.role = input.role;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.password) {
        updateData.passwordHash = await hashPassword(input.password);
      }

      const updated = await this.staffRepo.update(id, updateData, tx);

      // If deactivated, revoke all active sessions immediately
      if (input.isActive === false) {
        await this.sessionRepo.revokeAllForStaff(id, tx);
      }

      await this.audit.record(
        {
          actorId,
          action: input.isActive === false ? 'DEACTIVATE_STAFF' : 'UPDATE_STAFF',
          recordType: 'STAFF',
          recordId: id,
          oldValues: {
            fullName: existing.fullName,
            email: existing.email,
            role: existing.role,
            isActive: existing.isActive,
          },
          newValues: {
            fullName: updated.fullName,
            email: updated.email,
            role: updated.role,
            isActive: updated.isActive,
          },
        },
        tx,
      );

      const { passwordHash: _, ...sanitized } = updated;
      return sanitized;
    });
  }

  async deactivateStaff(id: string, actorId: string): Promise<Omit<Staff, 'passwordHash'>> {
    return this.updateStaff(id, { isActive: false }, actorId);
  }
}

export const staffService = new StaffService();
