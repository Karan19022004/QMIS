# QMIS ERP Full Panel Test Guide — Hierarchy Order

Regenerate PDF: `python3 reports/_build_full_panel_test_guide_pdf.py`

Updated: **18 October 2026** — Phase 3 Ops + Audit closed. Sheet TOTAL **480 / 0 / 0 / 0** of 480.  
Ops collections: `/api/v1/ops/{collection}` · Audit: `/api/v1/campus-audit/{collection}` · Alembic **0014**.  
Stack: PostgreSQL **18 @ 5433** · API `:8000` · Vite `:5173`.

**Module-by-module flow (every sidebar leaf):** see  
[`QMIS-ERP-Module-Flow-Test-Guide.md`](./QMIS-ERP-Module-Flow-Test-Guide.md)  
and PDF `reports/QMIS-ERP-Module-Flow-Test-Guide.pdf`  
(each module: **Do → Stored in → Reflects to → Pass**).

---

## Before you start

1. Start Postgres 18 (pgAdmin server on port **5433**). Confirm DB `qmis_erp` exists.
2. Backend:
   ```bash
   cd backend
   ./run-local.sh
   ```
   Expect Swagger at http://127.0.0.1:8000/docs and `DATABASE_URL=...@localhost:5433/qmis_erp`.
3. Frontend:
   ```bash
   cd ..   # repo root
   npm run dev
   ```
   Open http://localhost:5173
4. Flags (from `.env` / defaults with auth on): `VITE_USE_API_AUTH`, `ADMISSIONS`, `FINANCE`, academics / ops / campus-audit collections (defaults on with auth). Optional: `VITE_USE_API_OPS`, `VITE_USE_API_CAMPUS_AUDIT`.
5. Fresh campus: first API boot seeds roles/demo users. Account Head may need **Settings → Bootstrap campus fee ledger** once.
6. Confirm Alembic head includes **0014_ops_and_audit_records** (`alembic upgrade head`).

---

## Seed logins (development)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@qmis.edu | admin123 |
| HR | hr@qmis.edu | hr12345 |
| Account Head | accounthead@qmis.edu | accounts123 |
| PRM | prm@qmis.edu | prm12345 |
| Director | director@qmis.edu | director123 |
| Principal | principal@qmis.edu | principal123 |
| Coordinator | coordinator@qmis.edu | coord123 |
| Teacher | teacher@qmis.edu | teacher123 |
| Parent | (created on Admission enroll) | (set at enroll / seed) |
| Student | (optional student user link) | (if provisioned) |

Passwords follow `backend/.env` `*_SEED_PASSWORD` if you changed them.

---

## Hierarchy walkthrough (full campus E2E)

Run in this order. **Pass** = API 200, row survives browser refresh, and the next role can see the effect.

### Step 1 — Administrator
1. Sign in as **admin@qmis.edu**.
2. **Dashboard** — live KPIs from `/admin/dashboard` (or campus dashboard API).
3. **Class Details** — create/edit a class + section (masters API).
4. **User Creation** — confirm Teacher / Coordinator / Principal logins exist (or create PRM if missing).
5. **Documents / Announcements / Calendar / Communication** — open list (campus APIs).
6. **TC Request Approval** — list hydrates (may be empty).

### Step 2 — HR
1. Sign in as **hr@qmis.edu**.
2. **Dashboard** — employee / leave / recruitment KPIs from HR API snapshot (not static filler).
3. **Employees** — open portal list; ensure a teacher employee is linked (or create).
4. **Announcements / Notifications** — lists from HR collections; mark one notification read.
5. **Leave → Received** (`/hr/leave-request/received`) — hydrate via `/leave-requests`; no `schoolerp-leave-requests` in localStorage after load.

### Step 3 — Account Head
1. Sign in as **accounthead@qmis.edu**.
2. **Settings → Bootstrap campus fee ledger** (if installments empty).
3. **Fee Collection** — collect one tuition payment; confirm receipt + dashboard KPI updates.
4. **Approvals** — pending counts from finance snapshot.

### Step 4 — PRM (Front Office)
1. Sign in as **prm@qmis.edu** (or Admin admissions screens).
2. **Admission Enquiry → convert → Admission → Enroll** (creates student + parent login).
3. Note parent email/password from enroll response / seed.
4. Optional: raise **TC** / gate pass (front-office collections).

### Step 5 — Principal (academics SoT — newly Completed)
1. Sign in as **principal@qmis.edu**.
2. **Teacher Allocation** — allocate a teacher to a class/subject; refresh — row still present (`PUT /academics/teacher-allocations`).
3. **Class Timetable** — create timetable with timelines; refresh — still present (`PUT /academics/class-timetables`).
4. **Student Allocation** / Exam Timetable — smoke open (already Completed on sheet).
5. Decide any **timetable change request** if Teacher filed one later.

### Step 6 — Coordinator
1. Sign in as **coordinator@qmis.edu**.
2. **Period Chart** / **Lesson Plan Approval** — approve a submitted plan if present.
3. **Class Attendance** — open band/list (attendance API).
4. **Biometric** — Sync demo punches; refresh — rows still present (`PUT /ops/biometric-attendance`). Override remains Teacher-only.

### Step 7 — Teacher
1. Sign in as **teacher@qmis.edu**.
2. **Class Attendance** — mark Present/Absent → Save (`POST /attendance`); refresh persists.
3. **Lesson Plan** — submit monthly plan if due.
4. **Mark Entry** — draft/submit marks batch when exam exists.
5. **Class Timetable / TT change** — file a change request; Principal should see it after refresh.
6. **Biometric** — sync + optional override; refresh persists on ops collection.

### Step 8 — Director
1. Sign in as **director@qmis.edu**.
2. Approve pending **lesson plans / exams** in inbox if any.
3. **My Attendance** — linked employee (may be empty punches — OK).
4. Tasks / Escalations / Leave smoke.

### Step 9 — Parent / Student
1. Parent login from enroll — select child.
2. Timetable / results / attendance read paths (published data only).
3. Student portal if student user exists.

### Step 10 — Shared chrome (any staff role)
1. Announcement list · Calendar · Communication inbox · Notifications bell.
2. Leave (mine) · Escalation · Tasks — create one each if time allows.

### Step 11 — Ops verticals (module-wise create → refresh)
Use **Admin** for API smoke if role logins are not seeded. Pattern for every screen: open list → **Add** (or edit) → hard refresh (F5) → row still present.

| Role / area | Screens to open | Persist via |
|-------------|-----------------|-------------|
| Librarian | Book List, Issued Books, Members, Announcement, Communication, Calendar, Notifications, My Attendance | `/ops/library-*` + campus chrome APIs |
| Gate Keeper | Visitors, Inward/Outward, Handover, Vendors, Incidents, Gate Pass list, My Duty, Notifications, My Attendance | `/ops/gate-*` (+ FO gate passes) |
| Gate Keeper Manager | Assign Duty, Incidents, Team Attendance, Announcement, Leave received | `/ops/gate-*` |
| Canteen | Dashboard, Menu, Orders, Requests, Announcement | `/ops/canteen-*` |
| IT Support | Assets, Tickets, Requests, Announcement | `/ops/it-*` |
| Stationery | Inventory, Issue/Returns, Requests, Announcement | `/ops/stationery-*` |
| Housekeeping | Inventory, Duty, Schedules, Lost&Found, RO, SOM, Requests, Tasks | `/ops/hk-*` + shared inventory |
| Transport Manager | Drivers, Vehicles, Routes, Student Transport, Duty, Maintenance, Expenses, Approvals, **Route Data → Track** | `/ops/transport-*` + ProTrack |
| Driver | My Duty, Fuel, Maintenance, Student Attendance, Route stops | `/ops/transport-driver-*` |

### Step 12 — JD + Audit suite (module-wise)
| Role | Screens | Persist via |
|------|---------|-------------|
| Joint Director / Assistant | Dashboard, Employee overview, Request Approvals, Escalations, Meetings, Assets, Tasks, Announcement | `/ops/jd-*` |
| JD Audit | Templates, Checklist, Question bank, Scoring/Workflow/Visibility, Publish, Planning, Monitoring, Findings | `/api/v1/campus-audit/*` |
| Process Auditor | My Audits, Schedule, Execute, Observations, RCA, ATR, Escalations, Reports, Communication | `process-*` audit collections |
| Quality Auditor | Same shape as Process | `quality-*` audit collections |

### Step 13 — ProTrack365 live bus GPS (how to test)
**Already integrated:** backend proxy + Transport / Parent / Student Track Bus UI.

1. Confirm `backend/.env` has `PROTRACK_ADMIN_*` and `PROTRACK_PARENT_*` filled (copied from `.env.example` if needed).
2. **Restart API** (`Ctrl+C` then `./run-local.sh`) — `.env` is read at process start.
3. Quick API check (Swagger http://127.0.0.1:8000/docs or curl after login):
   - `GET /api/v1/protrack/status` → `configured: true`, `adminConfigured: true`
   - `GET /api/v1/protrack/devices?panel=admin` → list of IMEIs / plate numbers
   - `GET /api/v1/protrack/track?imeis=<oneImei>&panel=admin` → lat/lng/speed
4. **UI — Transport Manager** (need a transportmanager login, or Admin if you route there):
   - Open **Route Data** → **Track** on a route
   - Device dropdown should list ProTrack devices
   - Map bus marker should jump to live lat/lng; status shows Online/Offline; **Refresh GPS** works
5. **UI — Parent**: login as Parent → **Transport → Track Bus**
   - Uses parent panel account; pick a device; live marker updates ~every 15s
6. If amber banner “credentials are not configured” → `.env` empty or API not restarted.

### Step 14 — Biometric (what is done vs still open)
| Piece | Status |
|-------|--------|
| Teacher / Coordinator **Biometric Attendance** page | Wired — Sync + override; rows stored in `/ops/biometric-attendance` (PG) |
| Live **eSSL / RFID device** import | **Not done** — `RFID_IMPORT_ENABLED=false`; sync button is **simulated** (demo punches), not a real device pull |

**How to test current Biometric:**
1. Login `teacher@qmis.edu` → Attendance → **Biometric Attendance**
2. Click **Sync Biometric Data** → rows update; refresh page → still present
3. Override a row (Teacher only) → refresh → override kept
4. Coordinator path is read-oriented (no override)

When the school enables a real eSSL feed, we turn on `RFID_IMPORT_ENABLED` and add the import job — that is a separate integration.

---

## Per-role smoke checklists

### Admin
- [ ] Dashboard KPIs live  
- [ ] Class Details write  
- [ ] User Creation list  
- [ ] Campus Announcement / Calendar / Documents  

### HR
- [ ] Dashboard from HR snapshot  
- [ ] Employees list  
- [ ] Notifications mark-read  
- [ ] Received Leave API hydrate (no localStorage mirror)  

### Account Head
- [ ] Finance state hydrate  
- [ ] Collect payment → receipt  
- [ ] Approvals counts  

### PRM
- [ ] Enquiry → enroll + parent  

### Principal
- [ ] Teacher Allocation persists after refresh  
- [ ] Class Timetable persists after refresh  
- [ ] Decide TT change request  

### Coordinator / Teacher
- [ ] Attendance / lesson / marks paths  
- [ ] Biometric sync persists (`/ops/biometric-attendance`)  

### Director
- [ ] Approvals / My Attendance linked  

### Parent / Student
- [ ] Child select + read-only academics  

### Ops / Audit
- [ ] Library books refresh persist  
- [ ] Gate Visitors create → refresh  
- [ ] Transport vehicles hydrate  
- [ ] Canteen menu hydrate  
- [ ] JD Audit templates create → refresh  
- [ ] Process observations hydrate  
- [ ] Quality observations hydrate  

### ProTrack365
- [ ] `GET /protrack/status` → configured true (after API restart)  
- [ ] Transport Route Data → Track shows live lat/lng  
- [ ] Parent Track Bus shows devices from parent panel  

### Biometric (campus SoT)
- [ ] Teacher Sync → refresh persists  
- [ ] Teacher override → refresh persists  
- [ ] Live eSSL device — **out of scope until school enables**  

---

## Known gaps (do not fail the run)

| Area | Status |
|------|--------|
| Live RFID / eSSL device import | **Still needed** — UI/API store simulated punches only (`RFID_IMPORT_ENABLED=false`) |
| ProTrack365 | Integrated (UI + backend); needs API restart after `.env` fill |
| SMTP / WhatsApp / live payment gateway | Stub / demo mode |
| staff_ratings REST | Director Star Ratings still FE SoT |
| Some ops list UIs | Thin tables over campus JSON (CRUD depth varies) |

---

## Status matrix

`reports/QMIS-ERP-Role-Module-Status.480-complete.17oct.docx`  
`reports/QMIS-ERP-Role-Module-Status.docx` · `erp complete documentation/QMIS-ERP-Role-Module-Status.review.docx`
