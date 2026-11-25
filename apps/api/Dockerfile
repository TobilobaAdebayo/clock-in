# syntax=docker/dockerfile:1.7

# ==============================================================================
# Stage 1: Base image with pnpm enabled
# ==============================================================================
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat && corepack enable && corepack prepare pnpm@12.23.0 --activate
WORKDIR /app

# ==============================================================================
# Stage 2: Install workspace dependencies & build shared + api
# ==============================================================================
FROM base AS builder

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @clock-in/shared build \
 && pnpm --filter @clock-in/api prisma:generate \
 && pnpm --filter @clock-in/api build

# Deploy isolated production bundle for @clock-in/api
RUN pnpm --filter @clock-in/api --prod deploy /prod/api \
 && cp -R /app/apps/api/dist /prod/api/dist \
 && cp -R /app/apps/api/prisma /prod/api/prisma \
 && cp /app/apps/api/docker-entrypoint.sh /prod/api/docker-entrypoint.sh \
 && chmod +x /prod/api/docker-entrypoint.sh

# Regenerate Prisma client inside the deployed production bundle
WORKDIR /prod/api
RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma || npx --yes prisma@6.4.1 generate --schema=./prisma/schema.prisma

# ==============================================================================
# Stage 3: Minimal non-root production runtime
# ==============================================================================
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl curl \
 && addgroup -S clockin && adduser -S clockin -G clockin

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder --chown=clockin:clockin /prod/api ./

USER clockin
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
