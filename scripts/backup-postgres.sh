#!/usr/bin/env bash
# Automated daily PostgreSQL backup script for CLOCK IN
# Usage: DATABASE_URL="postgresql://..." BACKUP_DIR="/var/backups/clock-in" ./scripts/backup-postgres.sh

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is required." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/clock_in_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "[${TIMESTAMP}] Starting PostgreSQL backup..."
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_FILE}" \
  "${DATABASE_URL}"

# Verify backup archive integrity immediately
pg_restore --list "${BACKUP_FILE}" > /dev/null
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

echo "[${TIMESTAMP}] Backup created and verified: ${BACKUP_FILE}"

# Prune backups older than retention window
find "${BACKUP_DIR}" -type f \( -name "clock_in_*.dump" -o -name "clock_in_*.dump.sha256" \) -mtime "+${RETENTION_DAYS}" -delete
echo "[${TIMESTAMP}] Pruned backups older than ${RETENTION_DAYS} days."
