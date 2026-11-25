import { Request, Response, NextFunction } from 'express';
import { settingsService, SettingsService } from './settings.service.js';

export class SettingsController {
  constructor(private service: SettingsService = settingsService) {}

  getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await this.service.getSettings();
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.staffId;
      const updated = await this.service.updateSettings(actorId, req.body);
      res.json({
        success: true,
        message: 'Workspace settings updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const settingsController = new SettingsController();
