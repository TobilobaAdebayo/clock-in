# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable && corepack prepare pnpm@12.23.0 --activate
WORKDIR /app

FROM base AS builder

ARG NEXT_PUBLIC_API_URL=http://api:5000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm --filter @clock-in/shared build \
 && pnpm --filter @clock-in/web build

FROM node:22-alpine AS runner
RUN apk add --no-cache curl \
 && corepack enable && corepack prepare pnpm@12.23.0 --activate \
 && addgroup -S clockin && adduser -S clockin -G clockin

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=builder --chown=clockin:clockin /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder --chown=clockin:clockin /app/node_modules ./node_modules
COPY --from=builder --chown=clockin:clockin /app/packages/shared ./packages/shared
COPY --from=builder --chown=clockin:clockin /app/apps/web ./apps/web

USER clockin
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/check-in || exit 1

CMD ["pnpm", "--filter", "@clock-in/web", "start"]
