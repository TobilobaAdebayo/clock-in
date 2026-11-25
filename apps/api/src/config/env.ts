import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  WORKSPACE_TIMEZONE: z.string().default('Africa/Lagos'),
  WORKSPACE_NAME: z.string().default('Dare Adeboye Innovation Hub'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Environment validation failed:');
  parsedEnv.error.issues.forEach((issue) => {
    console.error(` - [${issue.path.join('.')}] ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsedEnv.data;
