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

| Email | Role |
|---|---|
| admin@qmis.edu | admin |
| hr@qmis.edu | hr |
| accounthead@qmis.edu | accounthead |
| finance.assistant@qmis.edu | finance_assistant |
| teacher@qmis.edu | teacher |
| coordinator@qmis.edu | coordinator |
| principal@qmis.edu | principal |
| director@qmis.edu | director |

Passwords come from the seed settings (*_SEED_PASSWORD in ackend/.env). Demo accounts are created only when ENVIRONMENT=development.

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
| Masters: classes, sections, academic years (13 Oct) | live, **reused** (`/masters/classes`, `/masters/sections`, `/masters/academic-years`; no new endpoint) | `classDetailsApi.js` + `useClassDirectory.js` (flag `VITE_USE_API_CLASSES`, falls back to the auth flag; local path unchanged when off) | Yes for the Administrator's Class Details screens — browser-verified. Details below |
| Masters: subjects | live | none | No — FE uses local data |
| Audit log | live | none | No |
| Notifications (Y-0) | live | `notificationsApi.js` (header bell: badge, list, mark read, 30 s poll; flag `VITE_USE_API_NOTIFICATIONS`) | Yes (checked in browser for principal and HR; teacher confirmed via API) |
| Approvals inbox (Y-0) | live | none (leave uses its own endpoints) | No |
| Lesson plans (Y-2) | live | `lessonPlanApprovalData.js` (localStorage) | No — shape differs (FE: grouped weekly template; API: monthly plan with JSON content) |
| Exams / marks / results (Y-3) | live | `markEntryApprovalData.js` (localStorage) | No — FE exam list and statuses differ; exam types are now seeded from the FE list |
| Leave (Y-4) | live | `leaveApi.js` + `leaveRequestData.js` (localStorage is only a cache of the API; flag `VITE_USE_API_LEAVE`, defaults to the students flag); HR screen added at `/hr/leave-request/received` | Yes — verified in browser: teacher applies → principal approves → HR approves → teacher sees Approved. Dates converted ISO ↔ dd-mm-yyyy in `mapApiLeave`. Not browser-checked: rejection path, Permission with times |
| Escalations (Y-5) | live | `escalationApi.js` + `escalationData.js` (flag `VITE_USE_API_ESCALATIONS`) | Yes — browser-verified (Teacher, Coordinator, Principal, Director, Admin): raise, receive, resolve and reject with note, close, 24h auto-escalation (clock moved +25h/+49h via the admin sweep), bell notifications, Director/Admin access rules. Known gaps: no Admin "all escalations" tab (API has it); notification click does not open the item; not browser-checked: Super Admin, student/parent/gatekeeper/librarian screens, named-recipient dropdown, old local-storage mode after the latest list change, real 24h wait. Note: React Compiler is on; list data must live in state, not in a memo keyed on a counter |
| Tasks (Y-5) | live (remarks + history, `clientRef` idempotency, assignment hierarchy added 13 Oct) | `taskApi.js` + `taskManagementData.js` (flag `VITE_USE_API_TASKS`, falls back to the students flag; local-storage path unchanged when off) | Yes — browser-verified (Principal, Teacher, Director, Admin) against the live backend: assign (single and several people, one task each), partial failure shown with a safe retry, status Pending → In Progress → Completed with remarks, overdue label, bell notifications, role restrictions, hierarchy rejection (403) shown on screen, flag-off regression. Details below |
| Admin User Creation and Roles (13 Oct) | live (`/admin/users`, `/admin/roles`; role-limited creation, one-time temporary password, deactivate instead of delete) | `adminUsersApi.js` + `createdUsersData.js` (flag `VITE_USE_API_ADMIN_USERS`, falls back to the auth flag; the local mirror never holds a password) | Yes — browser-verified; results are in `reports/testing-report.md` |
| Admin Employee Database (13 Oct) | live, **reused** (`GET /hr/portal/employees`, `GET /admin/users`; no new employee API or store) | `employeeDirectoryApi.js` + `useEmployeeDirectory.js` (flag `VITE_USE_API_EMPLOYEES`, falls back to the auth flag; local path unchanged when off) | Yes, read-only — browser-verified for the Administrator. Details below |

### Admin Employee Database (API mode) — how it works

- **Flag:** `VITE_USE_API_EMPLOYEES=true` (or the auth flag) and a signed-in session. Off, or no token → the screen reads its browser-only list exactly as before (checked: no API calls, original department list and text). The shared Principal / Director / Super Admin employee screens (`Common/UserDatabase/*`) are not touched and stay local-mode.
- **Data source:** two existing reads, run in parallel: `GET /hr/portal/employees` (the HR record) and `GET /admin/users` (logins created through User Creation). Nothing is written, and nothing is stored in the browser.
- **Operations the HR API supports today:** list and view (scoped by role), create (`POST /hr/employees`, `POST /hr/staff`, which also provisions a login), and a whole-collection save (`PUT /hr/portal/employees`). **Missing:** update or delete of a single employee, and any filter, search or paging parameters (the screen filters in the browser). The screen only needs list and view, so nothing was added to the API.
- **How HR employees relate to RBAC logins:** they are separate stores. `User` + `UserProfile` (User Creation) and `HrEmployee` are linked only by `user_id` or by email. The screen merges **by lower-cased email**: one person is one row, the HR record wins, and the matching login is noted on it ("Login created through User Creation (TEA-0002, Inactive)"). A login with no HR record shows as its own row (source "User Creation"). Logins that HR created through `/hr/staff` have no `UserProfile`, so `/admin/users` does not list them and their row says "Managed by HR".
- **What is shown:** an explicit allowlist. Salary is never copied (it shows "Restricted (HR)"); no password is shown (the server only holds a hash), and the free-form `extra` data is not copied. Fields HR does not hold (blood group, zip code, and so on) show "—".
- **States:** loading; error with Retry (a 403 shows "You do not have access to the employee records."); empty ("No employees have been added yet."); partial failure (the source that worked is shown with a warning naming the one that failed, plus Retry).
- **Data consistency fix (backend):** HR's bulk save derives login activity from the HR status, so a login that an administrator deactivated could be switched back on by the next HR save. `PATCH /admin/users/{id}` now keeps a linked HR record in step (matched by email; Active ⇄ Inactive; **Relieved and Terminated are never overwritten**) and writes an `HR_EMPLOYEE_STATUS_SYNCED` audit row. A negative-control test shows the bug is real without the sync.
- **Risks left open:**
  1. **Fixed (see "Database migrations" below).** `hr_employees.user_id` was `VARCHAR(36)` in older databases but a UUID in the model, so `GET /hr/portal/employees` returned **500** (`character varying = uuid`) for every role that is not full-access. Alembic revision `0002` converts it. The email-based matching in the sync is kept; it is still correct.
  2. HR statuses other than Active / Inactive (On Leave, Probation) are shown as HR states; they do not touch the login.
  3. The sync runs one way, from the admin API to HR. The reverse already existed: setting an HR employee to Inactive in the HR screen deactivates the login. The two stores are still not one record, so an HR status other than Active / Inactive (for example On Leave) is not pushed to the login.
  4. The department filter in API mode lists departments found in the data; HR and User Creation use different department names, so the list is a union.
  5. The list still has the older "From / To" date controls, which do nothing (pre-existing).

### Database migrations (Alembic, added 13 Oct 2026)

`create_all` builds missing tables but never alters existing ones, so databases created before a schema change keep the old shape. Schema changes are now versioned with Alembic (`backend/alembic/`, `backend/alembic.ini`). The connection URL comes from the app settings (`DATABASE_URL` / `backend/.env`); nothing secret is stored in the Alembic files.

- **Apply (existing or new database):** back up first, then from `backend`: `alembic upgrade head`. Check with `alembic current`. Undo the last one with `alembic downgrade -1`. A database that predates Alembic needs no stamping: the first revision is a no-op baseline.
- **Migrations are never run silently at startup.** Startup only logs `DATABASE SCHEMA BEHIND: …` when it finds known drift.
- **`0001_baseline`:** no change; the starting point.
- **`0002_hr_user_id_uuid`:** `hr_employees.user_id` VARCHAR(36) → UUID, plus the foreign key to `users.id` that the model declares (the live table had none). In one transaction, on PostgreSQL only: lock the table; **abort** (changing nothing) and list the employees if any `user_id` is not a UUID or names a login that does not exist; blank strings become NULL (counted; they carried no link); convert; compare every row and link with a snapshot taken first (a mismatch rolls back); add the foreign key. Re-running does nothing. `downgrade` restores VARCHAR(36) and drops the foreign key; values are kept.
- **Why the column was VARCHAR:** the `hr_employees` table was first created (UUID ids) from a model that had no `user_id`. Commit `7b248f5` (9 Oct) then added `user_id` to the model as a UUID foreign key to `users.id` **and**, in the same commit, to the startup helper `ensure_hr_employee_columns` as a hard-coded `VARCHAR(36)` with no foreign key. `create_all` cannot add a column to an existing table, so every database that already had the table got the helper's VARCHAR version, while a database created fresh from the model got UUID. The two definitions of one column disagreed. PostgreSQL writes a UUID into a VARCHAR without complaint but refuses to compare them, so the first read that filtered by `user_id` (HR "own record", used by every non-HR role) returned 500. The helper now adds the column as UUID on PostgreSQL.
- **`0003_class_year_uuid`:** `school_classes.academic_year_id` VARCHAR(36) → UUID, plus the foreign key to `academic_years.id` the model declares (the live table had none). Same safety rules as `0002`, with one more check: it also **aborts** if a class points at an academic year on a **different campus** (the API never allows that, so it can only be bad data). Cause: commit `ddfafcc` (10 Oct) added the column to the model as a UUID foreign key and to `ensure_masters_schema` as `VARCHAR(36)`; `GET /masters/classes?academic_year_id=<real year>` therefore returned 500. The startup helper now adds it as UUID on PostgreSQL, and the startup check also reports this drift. Academic years are only ever deactivated through the API (never hard-deleted), so the new foreign key blocks no endpoint; a year that classes use can no longer be removed by SQL either.
- **Found, not changed (other features, not needed for Class Details):** the same VARCHAR(36)-vs-UUID drift remains on `admission_enquiries.profile_image_file_id` and `admission_enquiries.converted_admission_id`, and `hr_employees.employee_code` is 32 characters live against 40 in the model. Each needs its own reviewed revision. Also, `models/masters.py` and `services/masters_service.py` are an unused integer-id duplicate of the masters models from Phase 0 (nothing imports them except `db/base.py`); they were left alone.

### Admin Class Details (API mode) — how it works

- **Flag:** `VITE_USE_API_CLASSES=true` (or the auth flag) and a signed-in session. Off, or no token → both screens use the browser-only catalog exactly as before (checked: the original seven columns, the teacher / capacity / room fields, a local save, and no API call).
- **Endpoints used (all existing):** `GET /masters/academic-years`, `GET /masters/classes[?academic_year_id=]`, `GET /masters/sections`, `POST /masters/classes` (creates the class **and** its first section; with no year given it uses the current academic year), `POST /masters/sections`. Nothing is edited or deleted: the API has **no class update or delete** (section rename and deactivate exist but the screen does not use them).
- **List screen:** loads years, classes and sections in parallel; any failure shows one error with **Retry** (the year filter is kept). Columns: Class, Section, Academic Year. The **Academic Year** filter calls `GET /masters/classes?academic_year_id=` on the server (this is the query that returned 500 before migration `0003`). A class with no year shows "—" and is not matched by a year filter. Empty states differ for "no classes" and "no match for these filters".
- **Add screen:** class (from the school's class list), academic year (default: the current one) and sections. Save is **safe to repeat**: it looks the class up by name first, creates it only if missing, then adds each missing section; a `409 section_exists` counts as already present. If some sections fail, the class is kept and the message says "press Save again to retry only the missing sections". The button is disabled while saving. A user without `masters.write` gets "You do not have permission to create classes."
- **What the server cannot store, so the screens do not show it in API mode:** class capacity, section capacity, class teacher and class room number. There are no such columns or fields in the backend. A note on each screen says so; Edit and Delete are hidden (no endpoint). Adding these needs a backend change and a decision, so it was not done here.
- **Other screens that read the class catalog** (student allocation, assigned classes, activities, lesson-plan approval, student documents, created-user data) still read the browser catalog `schoolerp-academics-catalog`. In API mode the list screen and every save **mirror** the server's classes and sections into that catalog (`mirrorApiClassDetails`): server wins on class and section names, teacher / capacity / room that only the browser knows are kept for a class with the same name, nothing is removed (classes cannot be deleted through the API), and it writes only when something changed. **Limit:** those other screens see a server class only after the Class Details list or Add screen has run in that browser; the mirror is not refreshed at sign-in.
- **Risks left open:** classes created through the API cannot be removed or renamed (so test classes stay); the dev database now holds class `V` (A, B, C) from the browser check. The class names come from a fixed list (`classDetailsOptions`), the API accepts any name. Student, subject and assignment screens are still local-only.

### Tasks (API mode) — how it works

- **Flag:** `VITE_USE_API_TASKS=true` (or the students flag) and a signed-in session. Off → the old local-storage screens run exactly as before (checked in the browser: assign, list, status update).
- **Status names:** backend `Incomplete` is shown as `Pending`; the UI never sends `Pending`, and moving a task back is refused client-side (the server also refuses: 409, no reopen).
- **Assignees:** loaded from `GET /tasks/assignees` (real active users). That endpoint only returns the caller's direct reports.
- **Several people:** the screen sends one `POST /tasks` per person (one assignee per task is a backend rule), in order. Each person has a stable `clientRef`; a retry of a lost response returns the existing task (HTTP 200, `idempotentReplay: true`), so no duplicates. A failure leaves the form locked and shows who was created and who failed, with "Retry failed (n)" that resends only the failed people.
- **Dates / overdue:** assigned date is set by the server; overdue is computed by the server on read (never stored by the client).
- **Remarks:** `POST /tasks/{id}/status` accepts an optional `remark` (max 2000). Every assignment and status change is stored in an append-only `task_events` table with the actor, role, remark and time; `GET /tasks/{id}` returns it as `history`; completion notifications to the assigner include the remark.
- **Assignment hierarchy (enforced on the backend, mirrors `ASSIGNMENT_HIERARCHY` in `taskManagementConfig.js` — change both together):** superadmin → admin; admin → director; director → principal, prm; principal → coordinator, teacher, librarian; prm → gatekeepermanager; gatekeepermanager → gatekeeper. Any other pairing, and any role not listed (teacher, coordinator, HR…), gets 403. Assigning to yourself stays 400.
- **Attachments:** not supported by the backend; the upload box is replaced by a note in API mode and hidden. Local mode keeps its upload box.
- **Not added (out of scope):** edit, delete, reopen.
- **Known gaps:** no Admin/Director "all tasks" screen (the API has `box=all` for admin, director/teacher get 403); only users the seed has can be assigned (Librarian, PRM, Gatekeeper roles have no users, so those paths are covered by backend tests only); "Retry failed" is also offered after a permanent rejection such as 403 (harmless, it fails again); the overdue claim race was fixed for tasks, but escalation auto-climb in `run_clock` could still send duplicate notifications if two list reads race (not changed); the API cache is in memory, so a page reload re-fetches.

Known gaps in the wired modules:

- `connectHrApi` and `connectFinanceApi` sign in with hard-coded seeded accounts when no token exists, instead of using the signed-in user. Fine for demo, must change before production.
- Logout cannot revoke a JWT (stateless); the client discards the token.
- Backend approval states are Pending / Approved / Denied (leave maps to the FE's Pending / Approved / Rejected).

Next frontend work, in order: lesson plans and marks (blocked on product decisions: weekly vs monthly plans, and an exam-schedule screen), each behind its own `VITE_USE_API_*` flag.
