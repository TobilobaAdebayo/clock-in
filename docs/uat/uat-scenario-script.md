# CLOCK IN — User Acceptance Testing (UAT) Scenario Script & Sign-Off

**Milestone:** Milestone 8 – UAT & Launch  
**Participants:** Front Desk Receptionist, Super Admin, Product / Operations Stakeholder  
**Devices Required:**
- 1 × Reception Tablet (landscape & portrait, Chrome/Safari)
- 1 × Mobile Phone (iOS Safari or Android Chrome)
- 1 × Desktop / Laptop (for Excel report inspection)

---

## Pre-UAT Setup Checklist
- [ ] Staging environment deployed over HTTPS (`GET /health` -> `200`, `GET /ready` -> `200`, `database: "connected"`).
- [ ] Migrations applied (`pnpm db:deploy`) and UAT accounts seeded (`SUPER_ADMIN` and `RECEPTIONIST`).
- [ ] Workspace timezone verified under **System Settings** (default `Africa/Lagos`).
- [ ] Paper register available for side-by-side comparison if importing historical records.

---

## UAT Scenarios

### Scenario 1: First-Time Visitor Registration (Tablet & Mobile)
**Actor:** Walk-in Guest (supervised by Receptionist)  
**Route:** `/check-in`

1. Open `/check-in` on the reception tablet (and repeat once on a mobile phone).
2. Select **New Visitor**, enter:
   - Full Name: `Ngozi Eze`
   - Phone Number: `08035551234`
   - Payment Frequency: `DAILY`
3. Submit the form.
4. **Expected Result:**
   - Green confirmation screen appears with server-generated check-in time.
   - Screen auto-resets cleanly after countdown so the next visitor cannot see previous details.
   - Re-submitting the same phone number under New Visitor shows a clear conflict prompt guiding the guest to Returning Visitor check-in.

| Device | Pass / Fail | Notes |
| --- | --- | --- |
| Reception Tablet | [ ] Pass / [ ] Fail | |
| Mobile Phone | [ ] Pass / [ ] Fail | |

---

### Scenario 2: Returning Visitor Privacy Lookup, Confirmation & Check-Out
**Actor:** Returning Guest  
**Route:** `/check-in`

1. Switch to **Returning Visitor** and enter phone `08035551234`.
2. **Expected Result (Privacy — FR-03 / FR-07):**
   - Only masked hints appear (`N**** E**` and masked phone digits); full name and attendance history are **not** shown.
3. Enter an **incorrect** confirmation name (e.g., `Wrong Name`) and submit.
   - **Expected Result:** Rejected with clear error message; check-in/out action remains blocked.
4. Enter the **correct** full name (`Ngozi Eze`) and submit.
   - **Expected Result:** Identity confirmed; visitor sees **Check Out** action (since they have an open session).
5. Tap **Check Out**.
   - **Expected Result:** Session closes with server timestamp and confirmation message.

| Check | Pass / Fail | Notes |
| --- | --- | --- |
| Masked hint only before confirmation | [ ] Pass / [ ] Fail | |
| Wrong name blocked | [ ] Pass / [ ] Fail | |
| Check-out succeeds & auto-resets | [ ] Pass / [ ] Fail | |

---

### Scenario 3: Duplicate Check-In Prevention (Active Session Rule)
**Actor:** Returning Guest  
**Route:** `/check-in`

1. Check `Ngozi Eze` back in as a returning visitor.
2. Immediately attempt to check in again (or tap rapidly twice).
3. **Expected Result:** System prevents a second open session (`409 Conflict` / clear already-checked-in state).

| Check | Pass / Fail | Notes |
| --- | --- | --- |
| Duplicate open session prevented | [ ] Pass / [ ] Fail | |

---

### Scenario 4: Receptionist Daily Workflow (Without Assistance)
**Actor:** Front Desk Receptionist  
**Routes:** `/login`, `/dashboard`, `/active`, `/visitors`, `/attendance`, `/reports`

1. Navigate to `/login` and sign in with the Receptionist account.
2. Verify **Dashboard** (`/dashboard`): Today's visit count, Currently Checked In count, weekly/monthly counts, and recent check-ins match reality.
3. Verify **Active Visitors** (`/active`): `Ngozi Eze` appears as currently checked in.
4. Open **Visitors** (`/visitors`), search by partial name (`Ngozi`) and by phone (`0803555`), open the visitor's profile, and verify visit counts and history.
5. Open **Attendance** (`/attendance`) and filter by date range and status (`ACTIVE` vs `CHECKED_OUT`).
6. Open **Reports** (`/reports`), export **Daily**, **Weekly**, **Monthly**, **Custom**, and **Individual Visitor** reports.
7. Open each downloaded `.xlsx` file in Microsoft Excel / LibreOffice Calc.
8. Verify Receptionist **cannot** see Administration links and receives `403` / redirect if visiting `/staff`, `/settings`, `/audit-logs`, or `/error-log`.
9. Test navigation drawer on a mobile phone viewport.

| Check | Pass / Fail | Notes |
| --- | --- | --- |
| Receptionist completed workflow without help | [ ] Pass / [ ] Fail | |
| All 5 Excel exports open cleanly & match filters | [ ] Pass / [ ] Fail | |
| Receptionist restricted from Admin tools | [ ] Pass / [ ] Fail | |
| Mobile/tablet navigation drawer usable | [ ] Pass / [ ] Fail | |

---

### Scenario 5: Forgotten Check-Out Correction & Audit Trail
**Actor:** Super Admin  
**Routes:** `/login`, `/attendance`, `/audit-logs`

1. Sign in as Super Admin on `/login`.
2. Locate `Ngozi Eze`'s open session on `/attendance` (simulating a visitor who forgot to check out).
3. Attempt correction with an invalid timestamp (check-out earlier than check-in) or empty reason -> verify validation rejects it.
4. Enter a valid check-out timestamp and a clear reason (e.g., `"Visitor confirmed departure at 5:30 PM"`), and save.
5. Open **Audit Logs** (`/audit-logs`) and verify a new `ATTENDANCE_CORRECTION` entry exists showing the actor, old values (`checkOut: null`), and new values (timestamp + reason).

| Check | Pass / Fail | Notes |
| --- | --- | --- |
| Validation rejects bad timestamps / empty reason | [ ] Pass / [ ] Fail | |
| Forgotten check-out corrected cleanly | [ ] Pass / [ ] Fail | |
| Audit log captures actor, old & new values | [ ] Pass / [ ] Fail | |

---

### Scenario 6: Staff Management, Settings & Error Log Triage
**Actor:** Super Admin  
**Routes:** `/staff`, `/settings`, `/error-log`

1. Under **Staff Accounts** (`/staff`), create a new Receptionist account, update their name, and deactivate them. Verify deactivated account can no longer sign in.
2. Attempt to deactivate the only active Super Admin -> verify the system blocks it.
3. Under **System Settings** (`/settings`), verify workspace name and IANA timezone update cleanly (and invalid timezones are rejected).
4. Under **Error Log** (`/error-log`), verify any captured error can be reviewed and marked `RESOLVED`.

| Check | Pass / Fail | Notes |
| --- | --- | --- |
| Staff CRUD & last-admin safeguard verified | [ ] Pass / [ ] Fail | |
| Settings update & timezone validation verified | [ ] Pass / [ ] Fail | |
| Error log review & resolve action verified | [ ] Pass / [ ] Fail | |

---

## UAT Findings & Fixes Log

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| UAT-01 | Medium | Fixed `w-64` sidebar compressed content on mobile phones | Added responsive collapsible mobile drawer + sticky top bar in `Sidebar.tsx` and responsive layouts | Fixed |
| UAT-02 | High | `prisma/seed.ts` seeded demo receptionist/visitors and allowed default admin password in production | Hardened `seed.ts` to require strong `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` in production and skip demo data by default | Fixed |
| UAT-03 | _TBD_ | _Record any live UAT session findings here_ | | |

---

## UAT Sign-Off & Paper Register Retirement Approval

By signing below, stakeholders confirm that:
1. All UAT scenarios passed and no Critical/High defects remain open.
2. The Front Desk Receptionist completed the daily workflow without assistance.
3. The physical paper attendance register can be retired following go-live cutover.

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Front Desk Receptionist | | | |
| Super Admin / Workspace Manager | | | |
| Technical Lead | | | |
