# QMIS ERP — Database Setup and Write Flow

Generated from a fresh clone of `https://github.com/karan4533/ERP-dev.git` into `c:\karan\QMIS` on 2026-10-27. Secrets are omitted.

## 1. Actual technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7 (repo root) |
| Backend | FastAPI, SQLAlchemy 2, Pydantic Settings, Alembic (`backend/`) |
| Auth | JWT bearer + OTP flows (`/api/v1/auth/*`) |
| Database | **PostgreSQL 18** via driver `psycopg` 3 (`postgresql+psycopg://…`) |
| Package managers | Frontend: `npm ci` (lockfile). Backend: `pip` + `.venv` |

The root `README.md` still describes a browser-only demo. That is outdated: with `VITE_USE_API_AUTH=true` (default), students, employees, admissions, HR, finance, and related modules call the FastAPI backend.

## 2. Database engine, host, port, and name

| Setting | Value |
|---|---|
| Engine | PostgreSQL 18.6 (Windows service `postgresql-x64-18`) |
| Host | `localhost` / `127.0.0.1` |
| Port | `5432` (this machine). Comment about `5433` did not apply here. |
| Database | `qmis_erp` (already existed; not dropped) |
| Runtime DB role | `qmis_app` (least-privilege; owns public tables for local migrate/create_all) |
| Schema revision | Alembic `0018_exam_academic_year` (head) |
| Table count | 54 public tables |

No MySQL. SQLite appears only in other sibling clones; this project’s intended engine is PostgreSQL.

## 3. Environment variable names required

### Frontend (gitignored `.env` at repo root)

- `VITE_API_BASE_URL` — e.g. `http://127.0.0.1:8000/api/v1`
- `VITE_USE_API_AUTH` — `true` for API sign-in / SoT defaults
- `VITE_USE_API_ADMISSIONS`, `VITE_USE_API_FINANCE`, `VITE_USE_API_TASKS`
- Optional overrides: `VITE_USE_API_STUDENTS`, `VITE_USE_API_EMPLOYEES`, `VITE_USE_API_*` (see `.env.example`)
- `VITE_ENABLE_DEMO_LOGINS` — keep `false` when using the API

### Backend (gitignored `backend/.env`)

- `ENVIRONMENT` — must be `development` for local placeholder secrets
- `DATABASE_URL` — `postgresql+psycopg://USER:PASSWORD@HOST:PORT/qmis_erp`
- `JWT_SECRET`, `OTP_DEBUG`, `CORS_ORIGINS`
- Seed account vars: `ADMIN_SEED_*`, `HR_SEED_*`, etc.
- Integrations: `INTEGRATIONS_MODE`, SMTP / Razorpay / WhatsApp / ProTrack vars (optional)

Placeholders only live in `.env.example` / `backend/.env.example`.

## 4. Exact startup commands

```bat
REM Frontend (repo root)
copy .env.example .env
npm ci
npm run dev -- --host 127.0.0.1 --port 5173

REM Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
REM edit backend/.env DATABASE_URL (never commit)
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000
```

Health checks used:

- Backend: `GET http://127.0.0.1:8000/health` → `{"status":"ok"}`
- Frontend: `GET http://127.0.0.1:5173/` → HTTP 200
- Swagger: `http://127.0.0.1:8000/docs`

On first boot, `app/main.py` `init_db()` runs `Base.metadata.create_all`, column ensure helpers, and development seed accounts. Existing rows are not truncated.

## 5. Database schema and key relationships

Core relations present in models:

- **Campus** → most business tables via `campus_id`
- **Admission enquiry** → **admission** → **student** (`admissions.enrolled_student_id`, `students.admission_id`)
- **Student** → **guardian**; optional `parent_user_id` / `student_user_id` → **users**
- **Student** → `academic_year_id`, `class_id`, `section_id` (placement)
- **HR employee** → optional `user_id` → **users** / **roles** (portal login)
- **Teacher allocation / academics** via campus JSON collections + dedicated tables (lesson plans, attendance, exams/marks)
- **Attendance** → `student_id`
- **Exams / marks** → `student_id`, exam types, weightages
- **Transport / library / ops** — primarily `ops_records` / campus collections keyed by collection name (API-backed JSON store), not only localStorage when API auth is on
- **TC requests** → `student_id`

Foreign keys and campus scoping are enforced in services; list endpoints filter by role (e.g. teacher roster vs coordinator grade band).

## 6. Student write flow (real files + routes)

Students are **not** created by a standalone “Add Student” form when API mode is on. Flow is admission → enroll.

| Step | File / route |
|---|---|
| Form UI | `src/Pages/Admin/FrontOffice/AdminssionList/*`, admission forms under Front Office / PRM |
| Frontend submit | `admissionListData.js` → `createAdmissionApi` / `enrollAdmissionAsStudent` |
| API client mapping | `src/services/admissionsApi.js` (`admissionFormToApi` snake_case) |
| Create admission | `POST /api/v1/admissions` → `backend/app/api/v1/endpoints/admissions.py` → `services/admissions.py` `create_admission` |
| Enroll | `POST /api/v1/admissions/{id}/enroll` → `enroll_admission` |
| ORM insert | `Student` + `Guardian` in `backend/app/models/admission.py`; `db.add` + `db.commit()` |
| List refresh | `GET /api/v1/students` → `src/services/studentsApi.js` → `hydrateEnrolledStudentsFromApi()` in `src/Common/StudentDatabase/enrolledStudentsData.js` |
| Authorized views | Admin / Super Admin / Principal / Coordinator / Teacher student lists hydrate from API when `isApiStudentsEnabled()` |

Finance can also call `POST /api/v1/students/sync-from-admissions` to enroll Active admissions missing student rows.

**Bug fixed during setup:** `AdmissionCreate` lacked `student_account_email` / `student_account_password` while `_apply_admission_fields` required them, causing HTTP 500 on create. Fields added in `backend/app/schemas/admissions.py`.

## 7. Employee write flow (real files + routes)

| Step | File / route |
|---|---|
| Form UI | `src/Pages/HR/EmployeeManagement/EmployeesList.jsx` (also offers flow in `Onboarding/Offers.jsx`) |
| Submit handler | `save()` → `createStaff(draft)` then `saveEmployees([...])` cache update |
| API | `src/services/hrApi.js` `POST /hr/staff` |
| Backend route | `backend/app/api/v1/endpoints/hr.py` `create_staff_route` |
| Service | `backend/app/services/hr.py` `create_staff` → insert `HrEmployee`, `_provision_user`, `db.commit()` |
| Alternate CRUD | `POST /api/v1/hr/employees` (`create_employee`) and `PUT /hr/portal/employees` (bulk replace + sync) |
| Directory UIs | `employeeDirectoryApi.js` merges `/hr/portal/employees` + admin users for staff lists / allocations |

HR in-memory cache (`hrStore.js`) is API-backed after `hydrateHrStore()`; it is not localStorage SoT when the API is available.

## 8. Real DB persistence vs browser storage / mocks

| Area | Persistence when API auth is on |
|---|---|
| Auth session | API JWT (+ `sessionStorage` token key) |
| Students / admissions / parents | PostgreSQL |
| HR employees / staff logins | PostgreSQL (`hr_employees`, `users`) |
| Leave, escalations, attendance, exams, finance, documents, announcements, calendar, TC, tasks | Backend APIs / campus collections → DB |
| Some teacher deliverables / legacy screens | May still use `localStorage` when a module flag is off or screen was never wired |
| Ops/audit demos | Prefer campus API collections; offline fallback keys listed in `campusCollectionRegistry.js` |
| Demo logins | Disabled when `VITE_ENABLE_DEMO_LOGINS=false` |

Do not treat toast success alone as a DB write; verify via API list + SQL.

## 9. Test results and evidence

| Check | Result |
|---|---|
| Postgres | `qmis_app` → `qmis_erp` @ `localhost:5432` (PG 18.6); existing data preserved |
| Alembic | `0018_exam_academic_year` (head) |
| Backend / frontend health | `:8000/health` ok; `:5173` HTTP 200 |
| Frontend production build | `npm run build` exit **0** |
| Focused suite (students/hr/admissions/phase0) | **17 passed**, 0 failed |
| Full pytest | **431 passed**, 34 skipped, **0 failed** (~3m48s) |
| DB CRUD | Employee create + admission create/PATCH/enroll verified via API + SQL; dashboard counts matched DB |
| FE↔BE | `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`; CORS OK; browser calls 200 in backend logs |

### Root causes fixed (original 2 failures + follow-ons)

1. **Enroll + student email without password** — optional student portal now skips login instead of 400 (`admissions.py`).
2. **Phase0 Grade 2 409** — shared SQLite StaticPool pollution; phase0 fixture resets memory schema.
3. **Seed HR links empty** — `autoflush=False` hid pending users; `db.flush()` before HR link seed.
4. **Local `.env` secrets leaking into tests** — conftest clears SMTP/ProTrack/Razorpay for deterministic gates.
5. **Attendance roster** — include pending (not only placed) students for “Not marked”.
6. **Finance stub confirm / WhatsApp legacy status** — dev stub confirm allowed; WhatsApp NOT_CONFIGURED maps to `queued_stub` for finance UI.
7. **TrackBus static check** — student `trackingMode` demo (not live) label restored.

Safe verification script: `backend/scripts/_verify_writes.py`.

## 10. Remaining issues / manual steps

1. **Secrets in chat:** Prefer rotating DB/SMTP/ProTrack credentials that were pasted earlier; they live only in gitignored `backend/.env`.
2. **Manual browser pass:** Optional UI logout/login walkthrough (Admission → Enrol → lists; HR → Add employee).
3. **Teacher roster RBAC:** Teachers only see allocated students — expected, not a persistence bug.
4. **Historical log noise:** Older uvicorn log lines may still show the pre-fix `AdmissionCreate.student_account_email` AttributeError; current schema includes those fields and creates succeed.

## Safety notes applied

- Worked only under `c:\karan\QMIS`
- Did not commit, push, deploy, drop, or truncate existing data
- Did not hardcode secrets into tracked source (temporary grant script deleted after use)
- `.env` / `backend/.env` remain gitignored
