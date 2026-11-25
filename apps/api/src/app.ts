import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { requestIdMiddleware } from './shared/middleware/request-id.js';
import { notFoundHandler } from './shared/middleware/not-found.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { rootRouter, v1Router } from './routes/index.js';

export const createApp = (): Express => {
  const app = express();

  // Trust first reverse proxy (Nginx / ALB / Fly / Render) for accurate req.ip and req.secure
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Enforce HTTPS in production (exempt internal liveness/readiness probes)
  if (env.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/health' || req.path === '/ready') {
        next();
        return;
      }
      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps = req.secure || forwardedProto === 'https';
      if (!isHttps) {
        res.status(403).json({
          success: false,
          error: {
            code: 'HTTPS_REQUIRED',
            message: 'HTTPS is required in production.',
          },
        });
        return;
      }
      next();
    });
  }

  // Hardened security headers & CORS allow-list
  app.use(
    helmet({
      hsts:
        env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cors(corsOptions));

  // Request correlation & strict input body size limits
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Global rate limiter for API routes
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  });
  app.use('/api/', globalLimiter);

  // Mount routes
  app.use('/', rootRouter);
  app.use('/api/v1', v1Router);

  // 404 & Central error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
