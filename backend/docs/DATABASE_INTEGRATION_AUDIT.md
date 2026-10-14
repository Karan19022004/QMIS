# School ERP — Database, API, Configuration and Data Flow Audit

**Date:** 14 October 2026 (evening)  
**Branch / commit inspected:** `main` @ `94684f5` (working tree had local doc-helper edits)  
**Scope:** Administrator modules + shared platform (DB, config, auth, migrations)  
**Database audited:** PostgreSQL `qmis_erp` @ `localhost:5432` (development)  
**Backend:** FastAPI uvicorn on `:8000`  
**Frontend:** Vite React on `:5173` (build verified)

Status values: **PASS** | **PARTIAL** | **FAIL** | **NOT RUN**

Secret values are never printed in this document. Keys are reported as configured / not configured only.

---

## 1. Final decision

### READY WITH KNOWN LIMITATIONS

Verified on the development stack:

| Area | Result |
|---|---|
| PostgreSQL connectivity | **PASS** |
| Alembic current = head (`0010_communication`) | **PASS** |
| SQLAlchemy models ↔ live tables (47/47, columns checked for Admin suite) | **PASS** |
| Startup schema drift warnings | **PASS** (none) |
| Backend pytest | **400 passed**, 1 warning |
| Live Admin read matrix (26 modules) | **26/26 PASS** |
| Persistence smoke (Calendar create → list → SQL row → cleanup) | **PASS** |
| Authz smoke (teacher dashboard 403; bad/missing token 401) | **PASS** |
| Frontend production build | **PASS** |
| Browser re-run of all Admin UIs this session | **NOT RUN** (prior 14 Oct evidence retained; see §8) |

Administrator delivery may proceed to the next role panel. Limitations in §9 are non-blocking for this decision.

---

## 2. Database architecture and connection flow

```
React (Vite)  --Bearer JWT-->  FastAPI (:8000)
                                  |
                                  +--> Settings (backend/.env via pydantic-settings)
                                  +--> SQLAlchemy engine (pool_pre_ping)
                                  +--> PostgreSQL qmis_erp
                                  +--> uploads/ (file_assets paths)
```

| Piece | Location | Behaviour |
|---|---|---|
| Connection URL | `DATABASE_URL` → `app.core.config.Settings.database_url` → `app.core.database.engine` | `postgresql+psycopg://…` in development |
| Session | `SessionLocal` / `get_db()` | request-scoped; `autoflush=False`, `autocommit=False` |
| Startup | `init_db()` in `app.main` lifespan | `Base.metadata.create_all()` for **missing** tables only; then legacy column helpers; `warn_if_schema_behind()`; seed reference data |
| Schema upgrades | Alembic `backend/alembic/` | **Not** auto-applied at startup. Operator runs `alembic upgrade head` after backup |
| Health | `GET /health` | liveness only (does not prove schema currency) |

**`create_all` vs migrations:** `create_all` is appropriate for bootstrapping empty databases and SQLite tests. It never alters existing columns. PostgreSQL upgrades that change types/constraints must use Alembic (`0002`–`0004` are the critical alter migrations; `0005`–`0010` add Admin tables). Relying on `create_all` alone on an old PG database causes the historically documented VARCHAR/UUID drift — now guarded by `schema_check`.

---

## 3. Tables and relationships (Administrator-relevant)

Live DB table count: **47** (matches `Base.metadata`). Alembic version table present; current revision **`0010_communication`**.

| Domain | Tables | Notes |
|---|---|---|
| Identity | `users`, `user_profiles`, `roles`, `permissions`, `role_permissions` | bcrypt password hashes; JWT `sub` = user id |
| Campus / masters | `campuses`, `academic_years`, `financial_years`, `school_classes`, `sections`, `subjects` | Class unique on `(campus, academic_year, name)`; sections soft-deactivate via class `is_active` |
| Admissions / students | `admission_enquiries`, `admissions`, `students`, `guardians` | FK / campus scoping in services |
| HR | `hr_employees`, `hr_records` | `user_id` must be UUID (migration `0002`) |
| Attendance | `student_attendance` (+ HR attendance collections) | Admin UI read-only |
| Workflow | `approval_requests`, `approval_events`, `leave_requests`, `escalations`, `tasks`, `task_events`, `notifications` | |
| Documents | `document_records`, `document_items`, `file_assets` | files on disk under `UPLOAD_DIR` |
| Announcements | `announcements`, `announcement_responses`, `announcement_replies` | |
| Calendar | `calendar_events` | activity overlays merged in service layer |
| TC | `tc_requests` | |
| Activities | `activities`, `activity_players` | |
| Communication | `conversations`, `conversation_participants`, `messages` | |
| Audit | `audit_logs` | middleware + service |
| OTP | `otp_challenges` | |

Deletion rules follow existing services (e.g. class hard-delete refused when dependencies exist; document/TC/activity downgrades refuse while rows exist). No destructive schema operations were run in this audit.

---

## 4. Module → API → table mapping

| # | Administrator module | Frontend service | Primary API | Persistence |
|---|---|---|---|---|
| 1 | Dashboard | `dashboardApi.js` | `GET /admin/dashboard` | aggregates (no dedicated table) |
| 2 | Admissions Enquiry | `admissionsApi.js` | `/admissions/enquiries` | `admission_enquiries` |
| 3 | Admission List | `admissionsApi.js` | `/admissions` | `admissions` |
| 4 | Student Database | `studentsApi.js` | `/students` | `students` |
| 5 | Employee Database | `employeeDirectoryApi.js` | `/hr/portal/employees`, `/admin/users` | `hr_employees`, `users` |
| 6 | Class Details | `classDetailsApi.js` | `/masters/classes`, `/masters/sections` | `school_classes`, `sections` |
| 7–8 | Attendance (S/E) | `adminAttendanceApi.js` | `GET /attendance?date=`, `GET /hr/attendance` | attendance tables (read) |
| 9–12 | Activities | `activitiesApi.js` | `/activities` | `activities`, `activity_players` |
| 13–14 | Documents | `documentsApi.js` | `/documents/students\|employees` | `document_records`, `document_items`, `file_assets` |
| 15–16 | Tasks | `taskApi.js` | `/tasks` | `tasks` |
| 17–18 | Leave | `leaveApi.js` | `/leave-requests` | `leave_requests` |
| 19 | Announcements | `announcementsApi.js` | `/announcements` | announcement tables |
| 20 | TC Approval | `tcApi.js` | `/tc-requests` | `tc_requests` |
| 21 | Communication | `communicationApi.js` | `/communication/*` | conversation/message tables |
| 22 | Calendar | `calendarApi.js` | `/calendar` | `calendar_events` |
| 23 | Notifications | `notificationsApi.js` | `/notifications` | `notifications` |
| 24 | Escalations | `escalationApi.js` | `/escalations` | `escalations` |
| 25–26 | RBAC | `adminUsersApi.js` | `/admin/users`, `/admin/roles` | users/roles |

Flags: most Admin APIs default **on** when `VITE_USE_API_AUTH=true` (see `src/services/apiClient.js`). Admissions still defaults **off** unless `VITE_USE_API_ADMISSIONS=true` (set in `.env.example`).

When a flag is off, screens may fall back to localStorage/sample data — that is intentional demo mode, not production persistence.

---

## 5. Configuration inventory (secrets redacted)

### 5.1 Backend (`backend/.env` / `Settings`)

| Key | Read in | Controls | Required | Safe default | Notes |
|---|---|---|---|---|---|
| `ENVIRONMENT` | `config.py` | prod vs development gates | Yes (prod-safe default=`production`) | production | Must be `development`/`dev`/`local` for placeholder secrets |
| `DATABASE_URL` | `config` → `database.py`, Alembic `env.py` | PG/SQLite connection | Yes for real runs | local PG with demo password | **Sensitive.** Default password rejected when not development |
| `JWT_SECRET` | `security.py` | HS256 signing | Yes | shipped placeholder | **Sensitive.** Blocked in non-development if weak |
| `JWT_EXPIRE_MINUTES` | token create | session length | Optional | 480 | |
| `OTP_*` / lockout keys | auth/rate limit | brute-force / OTP | Optional | numeric defaults | |
| `OTP_DEBUG` | auth responses | echo OTP | Optional | false | Only honoured in development |
| `CORS_ORIGINS` | `main.py` | browser origins | Yes for FE | localhost:5173 | `*` blocked in non-dev |
| `UPLOAD_DIR` | files/documents | disk storage root | Optional | `uploads` | |
| `ADMIN_SEED_*` / role seed emails+passwords | `seed.py` | demo accounts | Dev only | demo values | **Sensitive.** Created only when `seed_demo_accounts` |
| `INTEGRATIONS_MODE` | payments/notify | `demo` vs live vs stub | Optional | empty | `demo` blocked in non-dev |
| `RAZORPAY_*` | payments | gateway | Optional | empty/demo | **Sensitive** when live |
| `SMTP_*` | email notify | SMTP | Optional | empty/demo | **Sensitive** password |
| `WHATSAPP_*` | WhatsApp notify | HTTP API | Optional | empty/demo | **Sensitive** token |
| `RFID_IMPORT_ENABLED` | attendance import | feature flag | Optional | false | Off until school confirms |
| `TRUST_PROXY_HEADERS` | rate limit IP | X-Forwarded-For | Optional | false | |

Development `.env` inspected: **21 keys configured** (values not listed). Integrations are demo stubs — not live merchant/SMTP/WhatsApp.

### 5.2 Frontend (root `.env` / Vite)

| Key | Read in | Controls | Required | Notes |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | `apiClient.js` | API prefix | Optional | default `http://127.0.0.1:8000/api/v1` |
| `VITE_USE_API_AUTH` | `apiClient.js` | API login | Optional | default true |
| `VITE_USE_API_ADMISSIONS` | `apiClient.js` | admissions API | Optional | default **false** — must enable for Admin admissions persistence |
| `VITE_USE_API_*` (students, leave, documents, calendar, …) | `apiClient.js` | per-module API | Optional | most default on with auth |
| `VITE_ENABLE_DEMO_LOGINS` | `apiClient.js` | offline demo | Optional | false; **dev builds only** |
| `VITE_DEMO_PASSWORD` | `AuthContext.jsx` | demo password | Optional | **Sensitive**; never commit |

Root `.env.example` updated to document Admin module flags. No Redis usage found in application code.

---

## 6. Data storage / retrieval verification

| Check | Result | Evidence |
|---|---|---|
| Admin GET matrix 26 modules | **PASS** | `python scripts/audit_admin_modules.py` |
| Calendar create → list → SQL SELECT → DELETE | **PASS** | live API 201 + row in `calendar_events` |
| Teacher cannot read Admin dashboard | **PASS** | HTTP 403 |
| Invalid / missing JWT | **PASS** | HTTP 401 |
| Pytest persistence / auth / permissions | **PASS** | 400 passed |
| Browser refresh after save (all modules) | **NOT RUN** this session | Prior 14 Oct browser PASS for Documents, Dashboard, Calendar, Announcements, Notifications, Class Details |
| Logout/login re-fetch | **NOT RUN** this session | Covered indirectly by JWT + live GETs |

Partial/inconsistent writes: services use session commit/rollback patterns; file uploads validate size/signature before persist (pytest). No Critical integrity defect found.

---

## 7. Schema / migration findings

| Finding | Severity | Action |
|---|---|---|
| Live schema matches models (no missing/extra tables) | Info | None |
| Alembic head = current = `0010_communication` | Info | None |
| `create_all` + Alembic dual path | Known design | Documented; upgrades must use Alembic |
| Startup `schema_check` omitted Admin tables after 0005 | Medium (ops visibility) | **Fixed:** warn when alembic revision expects Admin tables that are missing |
| Duplicate `CalendarEvent` import in `models/__init__.py` | Low | **Fixed** |
| Audit script listed obsolete `document_folders` names | Low | **Fixed** → `document_records` / `document_items` |
| Audit script wrote extra `reports/*.json` | Process | **Fixed:** stdout only (reports/ keeps daily + testing only) |
| Documents paths show OpenAPI `False` in matrix | Low | Routes work (HTTP 200); OpenAPI path matching incomplete — non-blocking |
| Fresh DB init | **PASS** (pytest migration suites + create_all path) | Use commands in §11 |
| Upgrade without data loss | **PASS** for additive 0005–0010; alters 0002–0004 have abort-safe rules | Always backup first |

No destructive migration was applied during this audit.

---

## 8. Authentication and authorization findings

| Check | Result |
|---|---|
| Passwords hashed with bcrypt | **PASS** (`hash_password` / `verify_password`) |
| JWT HS256 with expiry | **PASS** |
| Protected Admin routes need Bearer | **PASS** (401 without/invalid) |
| Role/permission via `require_permission` | **PASS** (pytest + live 403s) |
| Frontend role switch cannot grant Admin API | **PASS** (server enforces) |
| Secrets not in frontend env for DB/JWT | **PASS** |
| Production refuses weak JWT / demo DB password / OTP_DEBUG / CORS `*` | **PASS** (`InsecureConfigurationError`) |
| Account deactivation / password-reset session revoke | **PARTIAL** | password change covered by suite; full refresh-token revoke N/A (no refresh tokens) |

---

## 9. Known limitations (non-blocking)

1. Roles UI is read-only by product scope.  
2. Documents list Delete is a Super Admin request stub.  
3. Admin Attendance screens are read-only.  
4. Notification click deep-link incomplete.  
5. Activities / TC / Communication browser create-click not re-run this session (live API covered).  
6. `VITE_USE_API_ADMISSIONS` defaults false — local FE without `.env` falls back to localStorage for admissions.  
7. Email/SMS/WhatsApp/Razorpay are demo/stub unless live credentials are supplied.  
8. `create_all` will not repair an already-wrong column type — Alembic required.  
9. No automated Playwright suite in repo.

---

## 10. Per-module scorecard (Administrator)

Legend: FE→API | API→DB | Persist | Authz | Browser

| # | Module | FE→API | API→DB | Persist | Authz | Browser |
|---|---|---|---|---|---|---|
| 1 | Dashboard | PASS | PASS | PASS (aggregates) | PASS | PASS (prior) |
| 2 | Admissions Enquiry | PASS* | PASS | PASS | PASS | PASS (prior) |
| 3 | Admission List | PASS* | PASS | PASS | PASS | PASS (prior) |
| 4 | Student Database | PASS | PASS | PASS | PASS | PASS (prior) |
| 5 | Employee Database | PASS | PASS | PASS (read) | PASS | PASS (prior) |
| 6 | Class Details | PASS | PASS | PASS | PASS | PASS (prior) |
| 7 | Student Attendance | PASS | PASS | PASS (read) | PASS | PASS (prior) |
| 8 | Employee Attendance | PASS | PASS | PASS (read) | PASS | PASS (prior) |
| 9–12 | Activities | PASS | PASS | PASS (API) | PASS | NOT RUN (UI) |
| 13–14 | Documents | PASS | PASS | PASS | PASS | PASS (prior) |
| 15–16 | Tasks | PASS | PASS | PASS | PASS | PASS (prior) |
| 17–18 | Leave | PASS | PASS | PASS | PASS | PASS (prior) |
| 19 | Announcements | PASS | PASS | PASS | PASS | PASS (prior) |
| 20 | TC Approval | PASS | PASS | PASS (API) | PASS | NOT RUN (UI) |
| 21 | Communication | PASS | PASS | PASS (API) | PASS | NOT RUN (UI) |
| 22 | Calendar | PASS | PASS | PASS (API+SQL this session) | PASS | PASS (prior) |
| 23 | Notifications | PASS | PASS | PASS | PASS | PASS (prior) |
| 24 | Escalations | PASS | PASS | PASS | PASS | PASS (prior) |
| 25 | RBAC Users | PASS | PASS | PASS | PASS | PASS (prior) |
| 26 | RBAC Roles | PASS | PASS | PASS (read) | PASS | PASS (prior) |

\*Requires `VITE_USE_API_ADMISSIONS=true`.

---

## 11. Development setup commands

```bash
# 1) PostgreSQL: create empty database qmis_erp (once)

# 2) Backend env
cd backend
copy .env.example .env   # Windows; then set ENVIRONMENT=development
# Edit DATABASE_URL / JWT_SECRET as needed (never commit .env)

# 3) Schema
python -m pip install -r requirements.txt
alembic upgrade head
alembic current          # expect 0010_communication

# 4) API
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Restart after code changes (no --reload in the verified run)

# 5) Frontend
cd ..
copy .env.example .env   # ensure VITE_USE_API_ADMISSIONS=true for admissions
npm install
npm run dev              # :5173

# 6) Verify
curl http://127.0.0.1:8000/health
cd backend
python -m pytest tests/ -q
python scripts/audit_admin_modules.py
```

**Backup (safe, non-destructive recommendation):** use `pg_dump` of `qmis_erp` before `alembic upgrade head` or any restore drill. Do not restore over the active DB without an explicit operator decision.

**Rollback note:** `0005`–`0010` refuse downgrade while tables hold rows. Prefer forward fixes over downgrade in shared development databases.

---

## 12. Tests executed this session

| Test | Result |
|---|---|
| DB `SELECT 1` + Alembic current/head | **PASS** |
| Model vs DB table/column diff (Admin suite) | **PASS** |
| `pending_schema_problems()` on live DB | **PASS** (empty) |
| Schema-related pytest subset | **16 passed** |
| Full `pytest tests/ -q` | **400 passed**, 1 warning, ~3 m 17 s |
| Live `audit_admin_modules.py` | **26/26 PASS** |
| Calendar persistence + authz smoke | **PASS** |
| `npm run build` | **PASS** (~46 s) |
| Full browser Admin click-through | **NOT RUN** |

Failed: **0**

---

## 13. Code / docs changed in this audit

| Change | Why |
|---|---|
| `backend/app/services/schema_check.py` | Warn when Alembic revision expects Admin tables that are missing |
| `backend/app/models/__init__.py` | Remove duplicate `CalendarEvent` import |
| `backend/scripts/audit_admin_modules.py` | Correct document table names; stop writing extra reports JSON |
| `.env.example` (repo root) | Document Admin `VITE_USE_API_*` flags |
| `backend/docs/DATABASE_INTEGRATION_AUDIT.md` | This deliverable |

Frontend UI/design was not changed.

Related prior evidence: `backend/docs/ADMINISTRATOR_MODULE_AUDIT.md`, `backend/docs/FRONTEND_INTEGRATION.md`.
