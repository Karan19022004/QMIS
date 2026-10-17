# QMIS ERP Full Panel Test Guide — Hierarchy Order

Regenerate PDF: `python3 reports/_build_full_panel_test_guide_pdf.py`

Updated: **17 October 2026** — Core Partials closed. Sheet TOTAL **313 / 0 / 165 / 2** of 480.  
Principal **21/21** · HR **35/35** · Teacher/Coordinator Biometric = **Gap**.  
Stack: PostgreSQL **18 @ 5433** · API `:8000` · Vite `:5173`.

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
4. Flags (from `.env` / defaults with auth on): `VITE_USE_API_AUTH`, `ADMISSIONS`, `FINANCE`, academics collections (defaults on with auth).
5. Fresh campus: first API boot seeds roles/demo users. Account Head may need **Settings → Bootstrap campus fee ledger** once.

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
4. **Biometric** — expect placeholder (**Gap** — skip).

### Step 7 — Teacher
1. Sign in as **teacher@qmis.edu**.
2. **Class Attendance** — mark Present/Absent → Save (`POST /attendance`); refresh persists.
3. **Lesson Plan** — submit monthly plan if due.
4. **Mark Entry** — draft/submit marks batch when exam exists.
5. **Class Timetable / TT change** — file a change request; Principal should see it after refresh.
6. **Biometric** — Gap — skip.

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
- [ ] Biometric = Gap (documented)  

### Director
- [ ] Approvals / My Attendance linked  

### Parent / Student
- [ ] Child select + read-only academics  

---

## Known gaps (do not fail the run)

| Area | Status |
|------|--------|
| Biometric (Teacher/Coordinator) | **Gap** — RFID/eSSL not enabled |
| Phase 3 Ops (Library, Gate, Canteen, IT, Stationery, HK, Transport, Driver) | **Not Completed** — UI/demo |
| Audit automation (JD Audit / Process / Quality) | **Not Completed** — localStorage/demo |
| SMTP / WhatsApp / live payment gateway | Stub / demo mode |
| staff_ratings REST | Director Star Ratings still FE SoT |

---

## Status matrix

`reports/QMIS-ERP-Role-Module-Status.docx` · `erp complete documentation/QMIS-ERP-Role-Module-Status.review.docx`
