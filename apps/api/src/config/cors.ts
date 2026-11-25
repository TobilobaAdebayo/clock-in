import { CorsOptions } from 'cors';
import { env } from './env.js';
import { ForbiddenError } from '../shared/errors/app-error.js';

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    // Allow requests with no origin (health probes, curl, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Disallow wildcard origin in production when credentials are enabled
    const isWildcardAllowed = env.NODE_ENV !== 'production' && allowedOrigins.includes('*');

    if (allowedOrigins.includes(origin) || isWildcardAllowed) {
      callback(null, true);
    } else {
      callback(new ForbiddenError(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  maxAge: 600,
};
