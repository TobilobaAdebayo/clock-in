# CLOCK IN — User Guide (Receptionists & Super Admin)

A quick, practical reference for day-to-day operations in **CLOCK IN**.

---

## 1. Guest Check-In Kiosk (`/check-in`)

Keep the reception tablet open to `/check-in` (bookmark it on the home screen).

### First-Time Visitors
1. Select **New Visitor**.
2. Enter **Full Name**, **Phone Number** (local format like `0803...` or international `+234...`), and **Payment Frequency** (`Daily`, `Weekly`, or `Monthly`).
3. Tap **Register & Check In**. The visitor is automatically checked in with the current server time.
4. The confirmation screen resets automatically after a few seconds for privacy.

### Returning Visitors (Check-In or Check-Out)
1. Select **Returning Visitor** and enter their registered phone number.
2. A masked hint (e.g., `N**** E**`) appears — no full details are shown yet.
3. Type their **Full Name** to confirm identity.
4. Tap **Check In** (when arriving) or **Check Out** (when leaving).

> **Note:** A visitor cannot check in twice without checking out first. If they forgot to check out on a previous day, ask the Super Admin to close the open session.

---

## 2. Receptionist Guide

### Signing In
1. Go to `/login` and enter your staff email and password.
2. Use the left sidebar (or top-left menu icon on a phone/tablet) to switch between pages.
3. Always click the **Sign Out** icon at the bottom of the sidebar on shared devices.

### Daily Tasks
- **Dashboard (`/dashboard`):** Check today's total visits, currently checked-in visitors, weekly/monthly visit totals, and the 5 most recent check-ins.
- **Active Visitors (`/active`):** See everyone currently inside the workspace right now, including their check-in time and payment frequency.
- **Visitors (`/visitors`):** Search any registered visitor by partial name or phone number. Click a visitor to open their **Profile** (`/visitors/[id]`), showing weekly/monthly visit counts and full visit history.
- **Attendance (`/attendance`):** Filter visits by date range, status (`Active` or `Checked Out`), or visitor name/phone.
- **Reports (`/reports`):**
  1. Choose a report type: **Daily**, **Weekly**, **Monthly**, **Custom Date Range**, or **Individual Visitor**.
  2. Pick the relevant date(s) or visitor.
  3. Click **Download Excel (.xlsx)**. The spreadsheet includes S/N, Visitor Name, Phone Number, Attendance Date, Time In, Time Out, Payment Frequency, and Attendance Status.

> **Need an attendance time fixed?** Receptionists have read-only access to attendance records for audit integrity. Contact your **Super Admin** to record any correction.

---

## 3. Super Admin Guide

Super Admins have all Receptionist tools plus the **Administration** menu in the sidebar.

### Correcting a Forgotten Check-Out (`/attendance`)
1. Go to **Attendance** (`/attendance`) and filter by status **Active** (or search the visitor's name).
2. Click **Correct** on the open session.
3. Enter the accurate **Check-Out** (or **Check-In**) time — check-out must be after check-in.
4. Enter a clear **Reason** (at least 5 characters, e.g., `"Visitor forgot to check out at 5:30 PM"`).
5. Save. The correction and old/new timestamps are automatically logged in **Audit Logs**.

### Managing Staff Accounts (`/staff`)
- **Create Staff:** Click **Add Staff**, enter full name, email, initial password (min 8 chars), and role (`Receptionist` or `Super Admin`).
- **Edit Staff:** Update name, email, role, or reset password.
- **Deactivate Staff:** Click **Deactivate** when a receptionist leaves. Their active sessions are revoked immediately so they can no longer access the portal.
- *Safeguard:* The system prevents deactivating or demoting the last active Super Admin.

### System Settings (`/settings`)
- Update the **Workspace Name** (displayed in headers/dashboard) and **Workspace Timezone** (must be a valid IANA timezone such as `Africa/Lagos`, `UTC`, or `Europe/London`).
- Changing the timezone immediately updates how dashboards and Excel exports bucket daily, weekly, and monthly dates.

### Audit Logs (`/audit-logs`)
- Review an immutable trail of all staff changes, attendance corrections, and setting updates.
- Filter by actor, action type, record type, or date range.

### Error Log (`/error-log`)
- Review any unexpected application errors captured automatically by the backend (passwords, tokens, and phone numbers are redacted).
- Update an error's triage status from `OPEN` -> `INVESTIGATING` -> `RESOLVED` once addressed.

---

## 4. Quick Troubleshooting

| Issue | What to Do |
| --- | --- |
| Guest says "Phone number already registered" | Switch from **New Visitor** to **Returning Visitor** and look up their phone number. |
| Guest gets "Too many lookup attempts" | Rate limit protects visitor privacy (10 lookups/min per IP). Wait 60 seconds and try again. |
| Guest cannot check in ("already checked in") | They have an open session from earlier. They can check out, or a Super Admin can correct the previous session. |
| Staff sees "Invalid email or password" | Verify email spelling and ask a Super Admin to verify the account is active or reset the password. |
| Excel export fails or times out | Narrow the custom date range (exports support up to 50,000 rows per file). |
