# Daily work report

Project: Queen Mira International School ERP  
Area: Phase 1 — Finance foundation  
Prepared for: Manager update  

New days go at the top. Older days stay below so the history is in one file.

---

## 13 October 2026

**Status:** Backend modules Y-0 to Y-4 built; leave and notifications now wired to the frontend and checked end to end in a browser; Y-5 (escalations with 24h clock, tasks) built on the backend.

### Done

1. **Audit against client docs** — enumerated the 185 live endpoints from OpenAPI. Found P0-6 (RBAC CRUD) and P0-7 (audit middleware) code exists but is not mounted; backlog corrected to PARTIAL.
2. **Y-0 Approval engine** — `approval_requests`, append-only `approval_events`, `notifications`; chains per doc (lesson plan / marks: Coordinator→Principal→Director). Rules: role must match current level, initiator cannot self-approve, denial needs a reason and ends the request (resubmit creates a new row, history kept), one pending per item.
3. **Notifications** — in-app, fan-out by user or role; list + mark read.
4. **Permissions** — `approvals.submit/decide/read`, `notifications.read` for academic staff, HR, stationery manager.
5. **Y-2 Lesson plans** (Academics doc 4.5) — monthly plan per teacher/class/subject; submit goes into the approval engine (Coordinator→Principal→Director); late flag if submitted after the 25th of the previous month; reminders from the 18th to the 25th (once per teacher per month); plan locks on submit; a denied plan is revised as a new version; teachers see approval status and events; approvers see all plans.
6. **Y-3 Exams, marks and results** (Academics doc 4.6 / 4.18) — configurable exam types (CA, RCT, Midterm, Final seeded); exam schedule created by Principal, approved by DA; marks entered per exam/subject/class as a draft (preview, editable), submit locks it; chain Coordinator→Principal→DA then published; denied batch revised as new version; validation (0..max, class match, absent flag, no duplicates); auto ranks and class-high per subject; DA-set weightage per class and exam type (must total 100, locked once an exam cycle starts) with weighted final percentage; parents see published results for their own child only.
7. **Backend ↔ frontend coordination audit** — compared every frontend API call with the live backend schema. Wired and matching: auth, admissions, parents, students, attendance, finance, HR, files. Fixed: frontend called `POST /auth/logout` which did not exist (now added and audited). Fixed: exam types now seeded from the frontend's own list. Not coordinated yet (backend only, frontend still on local demo data): masters, audit, approvals/notifications, lesson plans, marks, leave. Full table in `backend/docs/FRONTEND_INTEGRATION.md`.
8. **Y-4 Leave and permission** (Academics doc 4.9) — any staff role files a request; department head (same approver map as the frontend) then HR must approve; Permission is one day, max 2 hours; overlap check; reason required for denial; no edit/cancel; approved leave is exposed through an on-leave lookup so attendance can auto-mark Leave/Permission.
9. **Security fix** — generic `POST /approvals` can no longer open approvals for lesson plans, marks, exam schedules or leave (only their own endpoints can).
10. **Frontend integration of existing modules (leave + notifications)** — before adding more backend, the leave screens now read and write through the API (`leaveApi.js`, flag `VITE_USE_API_LEAVE`): apply (including Permission with hours), My Requests, Received, view, approve/reject (rejection needs remarks). The Received list shows a request to every approver in its chain, and the Approve/Reject box shows only to the role it is waiting on. HR had no leave screen, so one was added (HR sidebar "Staff Leave Requests"). The header bell now reads real notifications (`notificationsApi.js`): unread badge, dropdown, click to mark read, refreshes every 30 s.
11. **Manual browser check of the leave workflow (live backend + frontend)** — Teacher applied Casual Leave: success message, redirect, request LR-0001 shown as Pending, stored on the server with chain Principal → HR. Principal logged in: bell showed 1, request listed under Received, approved with remarks in the UI → moved to HR. HR logged in: bell showed 1, opened the request, approved in the UI → status Approved. Server confirmed the final state and the teacher received an "Approved: Casual Leave" notification. Bug found and fixed during the check: HR's remarks box was pre-filled with the Principal's remark. Not re-checked in the UI: the teacher's own bell dropdown after approval (confirmed through the API only) and the rejection path.
12. **Y-5 Escalations with the 24h clock** — a person raises an escalation one level up (student→teacher→coordinator→principal/director…→admin→super admin, same ladder as the frontend). The receiver has 24 hours: In Review, then Resolved/Rejected (note required). If nothing happens in 24 hours the clock moves it one level up per elapsed day, tells the old owner, the new owner and the raiser, and keeps the whole trail; earlier owners keep read access. At the top level a single overdue alert is sent. Only the person who raised it can close a resolved/rejected one. The clock runs whenever escalation/task lists are read and through an admin-only sweep endpoint (no scheduler yet).
13. **Y-5 Tasks** — staff assign a task (title, priority, due date) to another staff user; content cannot be edited or deleted; only the assignee moves Incomplete → In Progress → Completed (no reopening); assigner is told on completion; an overdue task alerts both people once. Assignee lookup endpoint added.
14. **Pytest** — **79 passed** (71 earlier + 8 new for escalations/tasks). Frontend production build passes.

### Not integrated on purpose (needs a decision first)

- **Lesson plans** — the frontend plans are weekly and approved by the Director only, with fixed names; the document and backend use monthly plans with Coordinator → Principal → Director. Needs: your decision (weekly vs monthly) and new review screens for Coordinator and Principal.
- **Marks / exams** — the frontend has no exam-schedule screen (exam names are a fixed list); backend needs Principal-creates / Director-approves. Needs a new screen before wiring.

### Still open / next build

- Escalations and tasks have no frontend wiring yet; the existing Escalation Management and Task Management screens still use local storage (the escalation screens already assume the same 24h rule and ladder, so wiring is mostly mapping).
- Leave: no balances/quota yet; attendance table does not yet read the on-leave lookup (student table only); emergency substitution not built. Decision: document says HR and department head both approve; the frontend used a single approver before. Backend and the frontend leave screens now follow the document (head, then HR).
- 24h clock needs a scheduler (cron) in production; today it runs when lists are read or the sweep endpoint is called.
- Exams: marks bulk is a JSON list (no CSV/Excel upload yet); question bank / key notes not built; no notification to all users when an exam schedule is published; student self-login view not possible until student users exist.
- Lesson plans: no attachment upload UI yet (fileId accepted), reminders must be triggered (no scheduler yet), frontend not wired.
- Not yet built from docs: immutability enforcement (attendance upsert and masters DELETE conflict with doc rule), RFID/iClock, refresh/logout/role switch, student user auto-create on admission fee payment.
- Doc conflict to decide: doc says no parent login; code has parent login.

---

## 12 October 2026

**Status:** Phase 1 identity journey closed (P1-1…P1-5). Docs + Archify refreshed. Manual browser Pass not claimed.

### Done

1. **Blank screen** — `HRRoutes` eager `EMPLOYEES[0]` before HR hydrate; lazy redirect fix.
2. **Postgres** — PG18 on `:5432`; `backend/.env` password set to user’s `Karan@123` (`Karan%40123` in URL).
3. **Admissions 500s (why A1–A8 failed)** — enquiry_code / guardian_name / ADM clash fixes + migrate.
4. **P1-4 Select Child** — `GET /parents/me/children`; ParentChildContext + smoke PASS.
5. **Seed academics logins** — teacher / coordinator / principal / director.
6. **Docs** — `API_BACKLOG` P1-4/P1-5 DONE; `TEAM_ROADMAP` / `FRONTEND_INTEGRATION` updated.
7. **P1-5 Students UIS** — `GET /api/v1/students`, `GET /api/v1/students/{id}`; `studentsApi.js`; Student Database list/detail hydrate when admissions API on; teacher/principal/director get `students.read`.
8. **Y-1 Class attendance** — `GET/POST /api/v1/attendance`, calendar map; `attendanceApi.js`; Teacher Class Attendance list loads API when enabled; `attendance.read/write` for teacher staff roles.
9. **Archify** — overview includes `mod_students`, `mod_attendance`, `studentsApi.js`, `attendanceApi.js` (finalize gates pass). Uncommitted endpoint files cite `main.py` mount until commit.
10. **Pytest** — **50 passed**.

### Still open / next build

- Phase 2 **Y-2** Lesson plans
- Manual browser Parent / Student Database / Teacher attendance Pass not claimed



---

## 10 October 2026 (Phase 1)

**Status:** Phase 1 Finance foundation implemented and tested. **45 pytest passed.** Persistence smoke **3/3** on `:8003`. Phase 2 not started.

### Done (Phase 1 only)

1. **Finance Head / Assistant permissions** (roles preserved)
   - `accounthead` = Finance Head: `finance.read` + `collect` + `write` + `approve`
   - `finance_assistant`: `finance.read` + `finance.collect` only (no config write / approve)
   - Seeded `finance.assistant@qmis.edu` / `finance123`
   - Routes wired: collect/send/settle/intent → collect|write; approve/confirm/concessions → approve|write; PUT state → write only

2. **Financial year (April–March)** separate from academic year
   - Table `financial_years` + `/masters/financial-years*` (list/create/get/current/patch/set-current)
   - Seed `FY 2026-27` (2026-04-01 → 2027-03-31)
   - Rejects non April–March ranges
   - Finance snapshot `meta` includes `financialYearId/Name/Start/End` + `financialYearStartMonth=April`

3. **Fee-structure validation (PostgreSQL SoT)**
   - On save: feeCategories / feeStructures / fineRules validated (ids, academicYear, class, non-negative amounts, no duplicate ids)
   - Snapshot still stored in `finance_records` (existing pattern — not a rewrite)

4. **Account Head persistence verification**
   - Pytest: save → new login → GET marker still present
   - Live smoke: `scripts/smoke_accounthead_persistence.py` → **3/3 PASS** (save, re-login, assistant PUT denied)
   - Full Chromium UI click-through: **NOT RUN** this session (no browser E2E harness); API path used as refresh/logout/login evidence

### Missing information (not assumed)

- Concession percentages and approval limits (school)
- Sibling/special concession rules
- Accounting / double-entry chart mapping
- Paytm vs Razorpay final approval (Razorpay left unchanged)
- Live SMTP / WhatsApp credentials
- RFID/eSSL requirement (remains disabled)

### Still open (Phase 2+)

- Core fee collection expansion, refunds, yearly increase
- Live Paytm/SMTP/WhatsApp when approved
- Ops verticals; browser E2E framework

### How to verify

- Head: `accounthead@qmis.edu` / `accounts123`
- Assistant: `finance.assistant@qmis.edu` / `finance123`
- `python -m pytest tests/ -q`
- `python scripts/smoke_accounthead_persistence.py http://127.0.0.1:8003`

---

## 10 October 2026 (earlier — demo integrations)

Demo Razorpay/SMTP/WhatsApp + HR↔Finance click-through; RFID off. See prior section in testing report history.
