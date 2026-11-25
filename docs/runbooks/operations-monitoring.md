# Deployment, Monitoring & NFR Verification Runbook

This document covers production deployment, HTTPS/domain setup, uptime monitoring, dependency audit governance, and the Milestone 7 Non-Functional Requirements (NFR) sign-off checklist.

---

## 1. Production Environment Configuration

Required environment variables for `apps/api`:

| Variable | Requirement | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables HTTPS enforcement, HSTS, secure cookies, and hides error stack traces |
| `PORT` | `5000` | HTTP listener port inside container/process |
| `DATABASE_URL` | PostgreSQL URI with TLS & pool params | Include `?sslmode=require&connection_limit=20&pool_timeout=20` |
| `CORS_ORIGIN` | Exact frontend origin(s), comma-separated | Wildcard `*` is rejected in production |
| `JWT_ACCESS_SECRET` | >= 32 cryptographically random chars | Generate via `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | >= 32 cryptographically random chars | Generate via `openssl rand -hex 32` (must differ from access secret) |
| `WORKSPACE_TIMEZONE` | Valid IANA timezone (e.g. `Africa/Lagos`) | Default fallback before DB setting is created |
| `WORKSPACE_NAME` | Workspace display name | Default fallback before DB setting is created |

Required environment variables for `apps/web`:
- `NEXT_PUBLIC_API_URL`: Internal or public base URL of the API (e.g. `https://api.clockin.workspace` or `http://api:5000` inside Docker).

---

## 2. Production Migrations & Deployment

### Running Migrations Safely
Production migrations use `prisma migrate deploy` (never `migrate dev`):
```bash
pnpm db:deploy
pnpm db:status
```
When deploying via `apps/api/Dockerfile`, `docker-entrypoint.sh` automatically runs `prisma migrate deploy` on container startup (`RUN_MIGRATIONS=true`).

### Running the Full Stack with Docker Compose
```bash
# Local development (Postgres only)
docker compose up -d

# Full containerized staging/production stack (Postgres + API + Web)
docker compose --profile full up -d --build
```

### HTTPS & Reverse Proxy (Caddy Example)
Terminate TLS at a reverse proxy (Caddy, Nginx, Cloudflare, or cloud load balancer) and forward `X-Forwarded-Proto: https` and `X-Forwarded-For`:

```caddyfile
clockin.workspace {
    reverse_proxy web:3000
}

api.clockin.workspace {
    reverse_proxy api:5000
}
```
The API sets `app.set('trust proxy', 1)` and enforces `req.secure || req.headers['x-forwarded-proto'] === 'https'` in production (exempting `/health` and `/ready` for internal load balancer probes).

---

## 3. Monitoring & Uptime Checks

| Endpoint | Check Type | Expected Status | Recommended Interval | Alert Condition |
| --- | --- | --- | --- | --- |
| `GET /health` | Liveness probe | `200 OK` (`status: "ok"`) | 30s | 3 consecutive failures -> restart container |
| `GET /ready` | Readiness & DB probe (`SELECT 1`, 3s timeout) | `200 OK` (`database: "connected"`) | 60s | 2 consecutive `503` responses -> page on-call |
| `GET /check-in` (Web) | External synthetic uptime check | `200 OK` | 60s | Status != 200 or latency > 5s -> alert |

Recommended external uptime monitors: **Better Stack (Uptime)**, **UptimeRobot**, or **Checkly**.
Application-level unhandled exceptions are automatically captured (with secrets and phone numbers redacted) in the `app_errors` table and reviewed by the Super Admin at `/error-log`.

---

## 4. Non-Functional Requirements (PRD Section 6) Verification Matrix

| Quality Attribute | Requirement | Implementation & Evidence | Status |
| --- | --- | --- | --- |
| **Security** | HTTPS in production, Argon2id hashing, protected sessions, Zod validation, rate limiting, Helmet/CSP, CORS allow-list, server-side RBAC | `apps/api/src/app.ts` (HTTPS guard, Helmet, 100kb limit, global limiter), `rate-limiters.ts` (auth/lookup/refresh/public limiters), `cors.ts` (strict allow-list, 403 block), `auth.controller.ts` (`HttpOnly`, `Secure`, `SameSite=Lax`), `apps/web/next.config.ts` (CSP, HSTS, X-Frame-Options, nosniff), verified by `hardening-concurrency-privacy.test.ts` & `staff-auth-rbac.test.ts` | Verified |
| **Privacy** | Guests cannot retrieve other visitors' details; no leaked PII, hashes, or tokens in responses/logs | `visitors.service.ts` (masked lookup hints; `lookupToken` stores HMAC `nameDigest`, zero plaintext name/phone), `staff.service.ts` (strips `passwordHash`), `redact.ts` + `error-handler.ts` + `app-errors.service.ts` (scrubs JWTs, DB URLs, Argon2 hashes, phone numbers, secrets), verified by `redact.test.ts` & `hardening-concurrency-privacy.test.ts` | Verified |
| **Reliability** | Concurrent check-ins never create duplicate active sessions; DB pooling; graceful shutdown; DB readiness probe | `migration.sql` (`unique_open_attendance_session` partial unique index), `attendance.service.ts` (transactional check + P2002->409 translation), `server.ts` (SIGTERM/SIGINT graceful HTTP drain + `prisma.$disconnect()` + 10s guard), `health.routes.ts` (`/ready` `SELECT 1` with 3s timeout), verified by `hardening-concurrency-privacy.test.ts` & `health.test.ts` | Verified |
| **Performance** | Prompt dashboard/search/attendance views; pagination; non-blocking exports | Indexed `attendances(visitor_id, check_in)` and `attendances(check_in)`, paginated endpoints (max 100/page), streaming ExcelJS export in 1,000-row batches with 50k cap | Verified |
| **Usability** | Simple, readable, mobile/tablet-friendly check-in UI | Responsive Tailwind CSS App Router pages tested in desktop & mobile Playwright configs | Verified |
| **Maintainability** | Modular monolith, typed shared schemas, OpenAPI docs, automated tests, CI/CD | `packages/shared`, modular `apps/api/src/modules/*`, `docs/api/openapi.yaml`, Vitest suite + Playwright smoke suite, `.github/workflows/ci.yml` | Verified |
| **Data Integrity** | DB constraints and transactions for attendance, staff, and audit logs | Prisma `$transaction` for check-in, corrections, staff updates, and atomic audit log writes; unique phone & email constraints | Verified |
| **Backup & Recovery** | Regular production backups and documented restore procedure | `scripts/backup-postgres.sh` + `docs/runbooks/backup-restore.md` (run restore drill against live staging DB before M8 launch) | Documented (Drill Pending Live DB) |
| **Compatibility** | Modern desktop and mobile browsers | Standard React 19 / Next.js 15 / Tailwind CSS; Playwright desktop Chromium & mobile Chrome projects configured | Verified |

---

## 5. Dependency Audit Governance (`pnpm audit --prod`)

- Resolved PostCSS and `uuid` advisories via `pnpm-workspace.yaml` `overrides`.
- Upgraded `zod` to `^4.6.6` across `@clock-in/shared` and `@clock-in/api` to remediate `GHSA-mrhx-c7xc-m3w5`.
- `pnpm audit --prod` passes with **0 vulnerabilities** (0 high, 0 critical), enforced in `.github/workflows/ci.yml` via `pnpm audit --prod --audit-level=high`.
