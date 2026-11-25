import { Router, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { checkDatabaseHealth } from '../../shared/db/prisma.js';

export const healthRouter: Router = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    workspace: env.WORKSPACE_NAME,
  });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth(3000);

  if (!dbHealthy) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    status: 'ready',
    database: 'connected',
    timestamp: new Date().toISOString(),
  });
});
