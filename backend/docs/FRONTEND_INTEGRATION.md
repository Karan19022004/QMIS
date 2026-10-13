# Frontend ↔ Backend integration

## Current `main` (UUID stack)

| Area | Status |
|---|---|
| Auth login | Wired — `VITE_USE_API_AUTH=true` |
| Forced password change | Wired — `POST /api/v1/auth/change-password` |
| File upload stub | Wired — `POST /api/v1/files` |
| HR module (partner) | Done — `hrApi.js` |
| Admissions (Phase 1) | Done — enquiry → convert → enroll; `VITE_USE_API_ADMISSIONS=true` |
| Parent children (P1-4) | Done — `GET /parents/me/children`; `parentsApi.js` |
| Finance | Done — snapshot + server actions; `VITE_USE_API_FINANCE=true` |
| Students UIS (P1-5) | Done — `GET /students`, `GET /students/{id}`; `studentsApi.js` |
| Class attendance (Y-1) | Done — `GET/POST /attendance`; `attendanceApi.js`; Teacher Class Attendance list |

See `ADMISSIONS_ANALYSIS.md`, `FINANCE_ANALYSIS.md`, and **`API_SOT_CUTOVER.md`** (HR/Finance API-only; no silent localStorage SoT).  
Archify overview: `.archify/architecture-project-overview/qmis-erp-overview.html` (includes Parents module).

### Seed logins

| Email | Password | Role |
|---|---|---|
| admin@qmis.edu | admin123 | admin |
| hr@qmis.edu | hr12345 | hr |
| accounthead@qmis.edu | accounts123 | accounthead |
| finance.assistant@qmis.edu | finance123 | finance_assistant |
| teacher@qmis.edu | teacher123 | teacher |
| coordinator@qmis.edu | coord123 | coordinator |
| principal@qmis.edu | principal123 | principal |
| director@qmis.edu | director123 | director |

### Run

1. Backend needs PostgreSQL (`DATABASE_URL` in `backend/.env`). If Postgres is down, smoke can use SQLite on `:8001` (see testing report).
2. Frontend `.env` (from `.env.example`):
   ```env
   VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
   VITE_USE_API_AUTH=true
   VITE_USE_API_ADMISSIONS=true
   VITE_USE_API_FINANCE=true
   ```
3. `npm run dev`

### Finance API

| Method | Path |
|---|---|
| GET/PUT | `/api/v1/finance/state` |
| POST | `/api/v1/finance/state/reset` |
| GET/PUT | `/api/v1/finance/{collection}` |
| POST | `/api/v1/finance/actions/collect-payment` |
| POST | `/api/v1/finance/actions/settle-cheque` |
| POST | `/api/v1/finance/actions/send-receipt` |
| POST | `/api/v1/finance/actions/gateway-intent` |
| POST | `/api/v1/finance/actions/apply-hr-concessions` |
| POST | `/api/v1/finance/actions/post-payroll-voucher` |
| POST | `/api/v1/finance/actions/decide-approval` |

Frontend: `src/services/financeApi.js` via `FinanceContext`.  
Live UI wiring: fees, books, transport fleet, wallets, approvals, collections/reports KPIs, SuperAdmin finance overview.  
Gateway / WhatsApp / email remain stubs (`queued_stub`) until production keys.

### Test case results (latest)

```
cd backend
python -m pytest tests/ -q
python scripts/smoke_campus_flow.py http://127.0.0.1:8001
```

Latest: full suite pytest — see `reports/testing-report.md` (includes students + attendance).  
Parent smoke includes `/parents/me/children`.

### Deferred (not blockers)

- RFID / eSSL punch import
- Production SMTP / WhatsApp / payment gateway keys
- Browser click-through against Postgres-backed API on `:8000`
- Academics emergency period reassignment


---

## Backend ↔ frontend coordination (audited 13 Oct 2026)

Method: every `apiRequest(...)` path in `src/` was compared to the live OpenAPI schema of the backend.

| Module | Backend | Frontend today | Coordinated? |
|---|---|---|---|
| Auth (login, me, change-password) | live | `authApi.js` | Yes |
| Auth logout | `POST /auth/logout` added 13 Oct | `apiLogout()` already called it | Yes (was a miss) |
| Admissions / enroll | live | `admissionsApi.js` | Yes |
| Parents (select child) | live | `parentsApi.js` | Yes |
| Students (list, detail) | live | `studentsApi.js` | Yes |
| Class attendance | live | `attendanceApi.js` | Yes |
| Finance | live | `financeApi.js` | Yes (snapshot + actions) |
| HR | live (generic collections) | `hrApi.js` / `hrStore.js` | Yes, whole-collection sync, not per-record |
| Files | live | `filesApi.js` | Yes |
| Masters (classes, sections, subjects, years) | live | none | No — FE uses local data |
| Audit log | live | none | No |
| Notifications (Y-0) | live | `notificationsApi.js` (header bell: badge, list, mark read, 30 s poll; flag `VITE_USE_API_NOTIFICATIONS`) | Yes (checked in browser for principal and HR; teacher confirmed via API) |
| Approvals inbox (Y-0) | live | none (leave uses its own endpoints) | No |
| Lesson plans (Y-2) | live | `lessonPlanApprovalData.js` (localStorage) | No — shape differs (FE: grouped weekly template; API: monthly plan with JSON content) |
| Exams / marks / results (Y-3) | live | `markEntryApprovalData.js` (localStorage) | No — FE exam list and statuses differ; exam types are now seeded from the FE list |
| Leave (Y-4) | live | `leaveApi.js` + `leaveRequestData.js` (localStorage is only a cache of the API; flag `VITE_USE_API_LEAVE`, defaults to the students flag); HR screen added at `/hr/leave-request/received` | Yes — verified in browser: teacher applies → principal approves → HR approves → teacher sees Approved. Dates converted ISO ↔ dd-mm-yyyy in `mapApiLeave`. Not browser-checked: rejection path, Permission with times |
| Escalations + tasks (Y-5) | live | none; `escalationData.js` / `taskManagementData.js` still localStorage | No — FE already assumes the same ladder and 24h rule; needs an API client and mapping |

Known gaps in the wired modules:

- `connectHrApi` and `connectFinanceApi` sign in with hard-coded seeded accounts when no token exists, instead of using the signed-in user. Fine for demo, must change before production.
- Logout cannot revoke a JWT (stateless); the client discards the token.
- Backend approval states are Pending / Approved / Denied (leave maps to the FE's Pending / Approved / Rejected).

Next frontend work, in order: escalations + tasks (client + mapping, no new screens needed), then lesson plans and marks (blocked on product decisions: weekly vs monthly plans, and an exam-schedule screen), each behind its own `VITE_USE_API_*` flag.
