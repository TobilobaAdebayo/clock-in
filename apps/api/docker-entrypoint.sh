#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying Prisma production migrations (prisma migrate deploy)..."
  ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma
fi

echo "Starting CLOCK IN API server..."
exec node dist/server.js
