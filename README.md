# CLOCK IN

**CLOCK IN** is a workspace attendance and visitor management system designed to replace paper-based attendance registers in shared workspaces.

## Monorepo Architecture

This project is structured as a pnpm monorepo:

- **`apps/api`**: Express + TypeScript modular monolith REST API with Prisma ORM and PostgreSQL.
- **`apps/web`**: Next.js App Router + Tailwind CSS frontend application with CSP security headers and Playwright smoke tests.
- **`packages/shared`**: Shared Zod schemas, TypeScript types, phone normalization/masking utilities, and domain constants.
- **`docs/`**: OpenAPI 3.0 specification (`docs/api/openapi.yaml`), architecture decision records (`docs/decisions/`), and operational runbooks (`docs/runbooks/`).
- **`scripts/`**: Operational scripts including automated PostgreSQL backups (`scripts/backup-postgres.sh`).

---

## Getting Started

### Prerequisites
- Node.js (v20+ or v22+)
- pnpm (v10+ / v12+)
- Docker & Docker Compose (for local PostgreSQL or containerized full-stack runs)

### Installation
```bash
# Install all dependencies across workspaces
pnpm install

# Build shared package
pnpm --filter @clock-in/shared build
```

### Environment Configuration
Copy `.env.example` in `apps/api`:
```bash
cp apps/api/.env.example apps/api/.env
```
Update `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` in `apps/api/.env`.

### Database Setup & Migrations
Start the local PostgreSQL database with Docker:
```bash
docker compose up -d
```
Generate Prisma client, run migrations, and optionally seed initial data:
```bash
pnpm db:generate
pnpm db:migrate     # Development migrations
pnpm db:deploy      # Production migrations (prisma migrate deploy)
pnpm db:status      # Check migration status
pnpm db:seed        # Seed initial Super Admin / workspace settings
pnpm db:import-historical -- --file docs/templates/historical-register-template.csv --dry-run
```

### Running in Development
```bash
# Run both backend API (port 5000) and frontend web (port 3000) concurrently
pnpm dev

# Or run API alone
pnpm --filter @clock-in/api dev

# Or run web alone
pnpm --filter @clock-in/web dev
```

---

## Testing, Verification & Quality Gates

```bash
# Typecheck entire workspace
pnpm typecheck
pnpm --filter @clock-in/api typecheck

# Run unit & integration test suites
pnpm test

# Production build (shared -> api -> web)
pnpm build

# Dependency security audit (production dependencies)
pnpm audit --prod

# End-to-end Playwright smoke suite (with web server running on localhost:3000)
pnpm --filter @clock-in/web test:e2e
```

---

## Production Deployment & Operations

### Full Containerized Stack
```bash
docker compose --profile full up -d --build
```
- **API Dockerfile**: `apps/api/Dockerfile` (multi-stage non-root image, runs `prisma migrate deploy` on boot, built-in `/health` check)
- **Web Dockerfile**: `apps/web/Dockerfile` (multi-stage non-root Next.js image)

### Documentation & Runbooks
- **OpenAPI 3.0 Specification**: [`docs/api/openapi.yaml`](docs/api/openapi.yaml)
- **User Guide (Receptionists & Super Admin)**: [`docs/guides/user-guide.md`](docs/guides/user-guide.md)
- **UAT Scenario Script & Sign-Off**: [`docs/uat/uat-scenario-script.md`](docs/uat/uat-scenario-script.md)
- **Go-Live Checklist, Rollback Plan & Issue Log**: [`docs/launch/go-live-checklist.md`](docs/launch/go-live-checklist.md)
- **Backup & Restore Runbook**: [`docs/runbooks/backup-restore.md`](docs/runbooks/backup-restore.md)
- **Operations, Monitoring & NFR Verification**: [`docs/runbooks/operations-monitoring.md`](docs/runbooks/operations-monitoring.md)
- **Historical Register Import Template**: [`docs/templates/historical-register-template.csv`](docs/templates/historical-register-template.csv)
