import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/db/prisma.js';

describe('Health & Readiness Routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health returns 200 and operational status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('uptime');
  });

  it('GET /ready returns 200 when database responds to SELECT 1', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);

    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('database', 'connected');
  });

  it('GET /ready returns 503 when database is unreachable', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'not_ready');
    expect(res.body).toHaveProperty('database', 'disconnected');
  });

  it('GET /non-existent-route returns 404 with standard error format', async () => {
    const res = await request(app).get('/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
