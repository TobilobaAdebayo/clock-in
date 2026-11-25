import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './shared/db/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`CLOCK IN API server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
});

// Align timeouts cleanly with reverse proxies (Nginx / ALB / Cloudflare)
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let isShuttingDown = false;

// Graceful shutdown handling: drain HTTP connections and disconnect Prisma pool
const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived ${signal}. Gracefully shutting down HTTP server and database connections...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (closeErr) => {
    if (closeErr) {
      console.error('Error closing HTTP server:', closeErr.message);
    }
    try {
      await prisma.$disconnect();
      console.log('HTTP server and Prisma database pool closed cleanly.');
      process.exit(closeErr ? 1 : 0);
    } catch (dbErr) {
      console.error('Error disconnecting Prisma client:', dbErr instanceof Error ? dbErr.message : dbErr);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
