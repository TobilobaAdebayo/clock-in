import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export const validateBody =
  (schema: ZodType<any>) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };

export const validateQuery =
  (schema: ZodType<any>) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.query = (await schema.parseAsync(req.query)) as Request['query'];
      next();
    } catch (error) {
      next(error);
    }
  };

export const validateParams =
  (schema: ZodType<any>) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.params = (await schema.parseAsync(req.params)) as Request['params'];
      next();
    } catch (error) {
      next(error);
    }
  };
