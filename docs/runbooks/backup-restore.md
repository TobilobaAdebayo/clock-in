# PostgreSQL Backup & Restore Runbook

This runbook documents the automated daily backup strategy and step-by-step disaster recovery restore procedure for **CLOCK IN** (PRD Section 6: Backup and Recovery NFR).

---

## 1. Backup Policy

| Parameter | Value |
| --- | --- |
| **Schedule** | Daily at `02:00 UTC` (low-traffic window) |
| **Format** | PostgreSQL custom archive (`pg_dump --format=custom --compress=9`) |
| **Integrity Verification** | `pg_restore --list` + SHA-256 checksum sidecar (`.sha256`) |
| **Retention** | 30 daily backups on-disk / object storage (encrypted at rest via S3/GCS/Supabase PITR) |
| **RPO / RTO Target** | RPO <= 24 hours (or <= 5 min with managed PITR); RTO <= 30 minutes |

> **Managed Postgres Note (Supabase / RDS / Cloud SQL):** Enable provider-managed daily automated backups and Point-in-Time Recovery (PITR) in addition to logical `pg_dump` exports for off-platform resilience.

---

## 2. Automated Daily Backup Setup

The repository includes [`scripts/backup-postgres.sh`](../../scripts/backup-postgres.sh).

### Option A: Linux Cron Job (Self-Hosted / VPS)
1. Store the production `DATABASE_URL` in a root-readable file `/etc/clock-in/backup.env` (`chmod 600`).
2. Add a daily cron entry (`crontab -e`):
   ```cron
   0 2 * * * . /etc/clock-in/backup.env && BACKUP_DIR=/var/backups/clock-in RETENTION_DAYS=30 /opt/clock-in/scripts/backup-postgres.sh >> /var/log/clock-in-backup.log 2>&1
   ```
3. Optional off-site upload (e.g. encrypted S3 bucket):
   ```bash
   aws s3 sync /var/backups/clock-in s3://clock-in-prod-backups/postgres/ --sse AES256
   ```

### Option B: Manual On-Demand Backup (Before Major Migrations)
```bash
export DATABASE_URL="postgresql://user:password@host:5432/clock_in?sslmode=require"
./scripts/backup-postgres.sh
```

---

## 3. Clean-Database Restore Procedure

Follow these steps to restore a backup into a clean PostgreSQL database (used both for disaster recovery and quarterly restore drills).

### Step 1: Verify Backup Integrity
```bash
sha256sum -c clock_in_20261124T020000Z.dump.sha256
pg_restore --list clock_in_20261124T020000Z.dump | head -n 30
```

### Step 2: Create a Clean Target Database
```bash
# Using psql against a PostgreSQL server
psql "$ADMIN_DATABASE_URL" -c "CREATE DATABASE clock_in_restore;"
```

### Step 3: Restore the Archive
```bash
export RESTORE_DATABASE_URL="postgresql://user:password@host:5432/clock_in_restore?sslmode=require"

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --dbname="$RESTORE_DATABASE_URL" \
  clock_in_20261124T020000Z.dump
```

### Step 4: Verify Schema, Indexes & Row Counts
Confirm all 7 tables and the critical partial unique index (`unique_open_attendance_session`) are intact:
```bash
psql "$RESTORE_DATABASE_URL" -c "
  SELECT 'visitors' AS table_name, COUNT(*) FROM visitors
  UNION ALL SELECT 'attendances', COUNT(*) FROM attendances
  UNION ALL SELECT 'staff', COUNT(*) FROM staff
  UNION ALL SELECT 'refresh_sessions', COUNT(*) FROM refresh_sessions
  UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
  UNION ALL SELECT 'app_errors', COUNT(*) FROM app_errors
  UNION ALL SELECT 'settings', COUNT(*) FROM settings;
"

psql "$RESTORE_DATABASE_URL" -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE indexname = 'unique_open_attendance_session';
"
```

### Step 5: Verify Prisma Migration Status & API Readiness
```bash
DATABASE_URL="$RESTORE_DATABASE_URL" pnpm db:status
# Expected: "Database schema is up to date!"

# Point staging/recovery API at RESTORE_DATABASE_URL and verify readiness probe:
curl -fsS http://localhost:5000/ready
# Expected: {"status":"ready","database":"connected",...}
```

### Step 6: Cutover (Disaster Recovery Only)
1. Stop write traffic (put API in maintenance mode or stop API containers).
2. Rename/swap databases or update `DATABASE_URL` in production secret store.
3. Restart API containers (`docker compose --profile full up -d`).
4. Verify `/health`, `/ready`, staff login, and recent visitor records.

---

## 4. Restore Drill Sign-Off Template

| Drill Date | Backup File Tested | Restore Duration | Row Count Match | Partial Index Verified | `/ready` Passed | Operator |
| --- | --- | --- | --- | --- | --- | --- |
| _YYYY-MM-DD_ | _clock_in_YYYYMMDD.dump_ | _e.g. 2m 15s_ | _Yes / No_ | _Yes / No_ | _Yes / No_ | _Name_ |
