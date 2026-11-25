# CLOCK IN — Go-Live Checklist, Rollback Plan & First-Week Monitoring

**Milestone:** Milestone 8 – UAT & Launch

---

## 1. Pre-Launch Readiness Checklist

### Infrastructure & Security
- [ ] Production PostgreSQL instance provisioned with automated daily backups and TLS (`sslmode=require`).
- [ ] Production `.env` / secrets manager configured (`NODE_ENV=production`, strong 32+ char `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, exact `CORS_ORIGIN`, pooled `DATABASE_URL`).
- [ ] Domain DNS configured and HTTPS/TLS certificates active for both frontend (`clockin.workspace`) and API (`api.clockin.workspace`).
- [ ] Verify `GET https://<api-domain>/health` returns `200` and `GET https://<api-domain>/ready` returns `200` (`database: "connected"`).
- [ ] Verify plain HTTP requests to production API are rejected (`403 HTTPS_REQUIRED`) or redirected at reverse proxy.
- [ ] Verify `pnpm audit --prod` passes with 0 high/critical vulnerabilities.

### Database, Seed & Historical Data
- [ ] Production migrations applied cleanly: `pnpm db:deploy` and verified with `pnpm db:status`.
- [ ] Production Super Admin seeded using strong env credentials (`NODE_ENV=production SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... pnpm db:seed`) — confirm no demo accounts or sample visitors exist in production.
- [ ] Real Receptionist account(s) created by Super Admin via `/staff` and credentials handed over securely.
- [ ] **(Optional) Historical Paper Register Import:**
  1. Prepare CSV using [`docs/templates/historical-register-template.csv`](../templates/historical-register-template.csv).
  2. Run dry-run first: `pnpm db:import-historical -- --file register.csv --dry-run`.
  3. Review validation output, fix any malformed lines, then run live import: `pnpm db:import-historical -- --file register.csv`.
  4. Spot-check imported visitors and attendance totals in `/visitors` and `/reports`.
- [ ] Clean-database backup & restore drill completed and logged in [`docs/runbooks/backup-restore.md`](../runbooks/backup-restore.md).

### UAT & Operations
- [ ] UAT completed on reception tablet and phone, and Stakeholder Sign-Off signed in [`docs/uat/uat-scenario-script.md`](../uat/uat-scenario-script.md).
- [ ] Reception tablet bookmarked to `/check-in` in kiosk/fullscreen mode.
- [ ] User Guide ([`docs/guides/user-guide.md`](../guides/user-guide.md)) shared with receptionists and Super Admin.
- [ ] External uptime monitors configured on `/health`, `/ready`, and `/check-in` with alert notifications enabled.

---

## 2. Go-Live Cutover Sequence

1. **T-1 day:** Freeze staging schema, take pre-launch DB snapshot, run final smoke test (`pnpm test`, `pnpm --filter @clock-in/web test:e2e`).
2. **T-0 morning (before workspace opens):**
   - Deploy tagged production images (`docker compose --profile full up -d --build` or cloud platform release).
   - Confirm `/health` and `/ready` green.
   - Perform 1 live sanity check (register test visitor, verify dashboard, verify daily Excel export, then remove test entry if desired).
3. **Day 1–3 (Optional Parallel Safety Buffer):** Keep the paper register stored behind the reception desk *only* as an emergency fallback; direct all walk-in visitors to the tablet kiosk.
4. **End of Day 3:** Confirm zero data-loss incidents and officially retire the paper register.

---

## 3. Confirmed Rollback Plan

Trigger rollback if a **P0/P1 incident** occurs (e.g., check-in unavailable for > 10 minutes, authentication broken, or data integrity regression):

### Level 1: Application-Only Rollback (No Schema Breakage — ~3 minutes)
1. Deploy the previous known-good container image tags for `clock-in-api` and `clock-in-web` (or `git checkout <previous-release-tag>` and redeploy).
2. Verify `GET /health` (`200`) and `GET /ready` (`200`).
3. Confirm guest check-in and staff login work end-to-end.

### Level 2: Database Rollback (Migration or Data Corruption — ~15–25 minutes)
1. Place frontend/API in maintenance mode (stop API containers to halt writes).
2. Restore the latest verified pre-deployment backup following [`docs/runbooks/backup-restore.md`](../runbooks/backup-restore.md) Steps 1–6.
3. Redeploy the previous application release matching the restored schema.
4. Verify `/ready` returns `200` and row counts match expected totals.

### Level 3: Operational Continuity Fallback (Immediate — 0 minutes)
1. Receptionist temporarily logs incoming/outgoing guests on the physical backup sheet (`Full Name, Phone, Payment Frequency, Time In, Time Out`).
2. Once CLOCK IN is restored, transcribe temporary entries into a CSV matching [`historical-register-template.csv`](../templates/historical-register-template.csv) and ingest via `pnpm db:import-historical`.

---

## 4. First-Week Monitoring Schedule

Perform a 5-minute check each morning and evening during Week 1:

| Day | Morning Check (Opening) | Evening Check (Closing) | Owner | Status |
| --- | --- | --- | --- | --- |
| **Day 1** | Verify `/ready`, kiosk tablet online, first 3 live check-ins | Check `/error-log`, review forgotten check-outs in `/active`, download Daily Excel | Tech Lead + Admin | [ ] |
| **Day 2** | Verify automated `02:00 UTC` backup archive & `.sha256` checksum | Check `/error-log`, check receptionist feedback | Tech Lead + Admin | [ ] |
| **Day 3** | Verify `/ready` latency & uptime monitor (100% target) | Verify zero open P0/P1 issues; confirm paper register retirement | Admin + Stakeholders | [ ] |
| **Day 4** | Verify nightly backup + disk space | Review `/audit-logs` for any corrections | Admin | [ ] |
| **Day 5** | Verify `/ready` and weekly metrics on `/dashboard` | Export **Weekly** Excel report and reconcile with desk totals | Receptionist + Admin | [ ] |
| **Day 6–7** | Verify automated weekend backups & uptime alerts | Close Week-1 review; archive resolved issues | Tech Lead + Admin | [ ] |

---

## 5. Post-Launch Issue Log

| Issue ID | Date Reported | Reported By | Severity (P0–P3) | Description | Workaround / Resolution | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _ISS-001_ | _YYYY-MM-DD_ | _Name_ | _P2_ | _Example entry — replace during Week 1_ | | | _Open / Resolved_ |
