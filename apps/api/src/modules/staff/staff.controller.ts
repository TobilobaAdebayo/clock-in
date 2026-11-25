import { Request, Response, NextFunction } from 'express';
import { staffService, StaffService } from './staff.service.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { Role } from '@prisma/client';

export class StaffController {
  constructor(private service: StaffService = staffService) {}

  listStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const { search, role, isActive } = req.query;

      const criteria = {
        search: search ? String(search) : undefined,
        role: role ? (String(role).toUpperCase() as Role) : undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      };

      const result = await this.service.listStaff(criteria, pagination);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const staff = await this.service.getStaffById(id);
      res.json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  };

  createStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.staffId;
      const staff = await this.service.createStaff(req.body, actorId);
      res.status(201).json({
        success: true,
        data: staff,
        message: 'Staff account created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  updateStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = req.user!.staffId;
      const staff = await this.service.updateStaff(id, req.body, actorId);
      res.json({
        success: true,
        data: staff,
        message: 'Staff account updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deactivateStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = req.user!.staffId;
      const staff = await this.service.deactivateStaff(id, actorId);
      res.json({
        success: true,
        data: staff,
        message: 'Staff account deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const staffController = new StaffController();
