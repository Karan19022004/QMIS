# Administrator module — end-to-end audit

**Date:** 14 October 2026 (evening audit)  
**Branch / commit:** `main` @ `10ac4fc` (aligned with `origin/main`)  
**Working tree:** clean except untracked `make_admin_status_proof.py` (helper; not required)  
**Database:** PostgreSQL `qmis_erp` @ `localhost:5432`, Alembic current = head `0010_communication`  
**Backend:** uvicorn on `:8000` (no `--reload`)  
**Frontend:** Vite on `:5173`  

Status values: **PASS** | **PARTIAL** | **FAIL** | **NOT RUN**

---

## 1. Go / No-Go

### READY WITH KNOWN LIMITATIONS

All 26 scoped Administrator modules have a frontend service, a live backend read path (admin → HTTP 2xx), and matching permissions for sensitive admin-only routes (Dashboard, TC, Documents, RBAC → teacher 403 where expected). Full pytest **400 passed**. Production build **PASS**. No critical or high data-integrity defects were found that block moving to the next modules.

Known limitations (non-blocking for this decision) are listed in §9.

---

## 2. Module completion status

| # | Module | FE→API | Persist (tables) | Authz (live) | Automated | Browser | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard | `dashboardApi.js` → `GET /admin/dashboard` | aggregate counts | admin 200 / teacher 403 | PASS | PASS (14 Oct KPIs) | **PASS** |
| 2 | Admissions Enquiry | `admissionsApi.js` → `/admissions/enquiries` | `admission_enquiries` | admin 200 / teacher 403 | PASS | PASS (earlier) | **PASS** |
| 3 | Admission List | `admissionsApi.js` → `/admissions` | `admissions` | admin 200 / teacher 403 | PASS | PASS (earlier) | **PASS** |
| 4 | Student Database | `studentsApi.js` → `/students` | `students` | admin 200 / teacher 200 (read) | PASS | PASS (earlier; admissions/{id} N+1 fixed) | **PASS** |
| 5 | Employee Database | `employeeDirectoryApi.js` → `/hr/portal/employees` + `/admin/users` | `hr_employees`, `users` | admin 200 | PASS | PASS (earlier; read-only) | **PASS** |
| 6 | Class Details | `classDetailsApi.js` → `/masters/classes|sections` | `school_classes`, `sections` | admin 200 | PASS | PASS (14 Oct CRUD) | **PASS** |
| 7 | Student Attendance | `adminAttendanceApi.js` → `GET /attendance?date=` | attendance rows | admin 200 (date required) | PASS | PASS (earlier; **read-only**) | **PASS** |
| 8 | Employee Attendance | `adminAttendanceApi.js` → `GET /hr/attendance` | HR attendance collection | admin 200 | PASS | PASS (earlier; **read-only**) | **PASS** |
| 9 | Cultural Activities | `activitiesApi.js` → `/activities?type=cultural` | `activities` | admin 200 | PASS | NOT RUN (UI create); live API create 201 | **PASS** |
| 10 | Sports Activities | same | `activities` | admin 200 | PASS | NOT RUN (UI); live API 201 | **PASS** |
| 11 | Chess Results | sports + `players` | `activities`, `activity_players` | admin 200 | PASS | NOT RUN (UI); live API players+approve | **PASS** |
| 12 | Competitions | `type=competition` | `activities` | admin 200 | PASS | NOT RUN (UI); live API 201 | **PASS** |
| 13 | Student Documents | `documentsApi.js` → `/documents/students` | `document_records`, `document_items`, `file_assets` | admin 200 / teacher 403 | PASS | PASS (14 Oct upload/replace/view) | **PASS** |
| 14 | Employee Documents | `/documents/employees` | same | admin 200 / teacher 403 | PASS | PASS (14 Oct EMP-0016) | **PASS** |
| 15 | Task Assignment | `taskApi.js` → `/tasks?box=assigned` | `tasks` | admin 200 | PASS | PASS (earlier) | **PASS** |
| 16 | Assigned Tasks | `/tasks?box=mine` | `tasks` | admin 200 | PASS | PASS (earlier) | **PASS** |
| 17 | My Leave Requests | `leaveApi.js` → `/leave-requests?box=mine` | `leave_requests` | admin 200 | PASS | PASS (earlier); API mode memory-only | **PASS** |
| 18 | Received Leave Requests | `box=received` | `leave_requests` | admin 200 | PASS | PASS (earlier) | **PASS** |
| 19 | Announcements | `announcementsApi.js` → `/announcements` | `announcements`, replies/acks | admin 200 | PASS | PASS (list/create/ack/reply) | **PASS** |
| 20 | TC Request Approval | `tcApi.js` → `/tc-requests` | `tc_requests` | admin 200 / teacher 403 | PASS | NOT RUN (UI approve); live API create→forward→approve | **PASS** |
| 21 | Communication | `communicationApi.js` | `conversations`, `messages`, … | admin 200 | PASS | NOT RUN (UI send); live API start+send | **PASS** |
| 22 | Calendar | `calendarApi.js` → `/calendar` | `calendar_events` (+ activity overlay) | admin 200 | PASS | PASS (Upcoming hydrate) | **PASS** |
| 23 | Notifications | `notificationsApi.js` → `/notifications` | `notifications` | admin 200 | PASS | PASS (bell + page mark-read) | **PASS** |
| 24 | Escalation Management | `escalationApi.js` | `escalations` | admin 200 | PASS | PASS (earlier); API mode memory-only | **PASS** |
| 25 | RBAC User Creation | `adminUsersApi.js` → `/admin/users` | `users`, `user_profiles` | admin 200 / teacher 403 | PASS | PASS (earlier) | **PASS** |
| 26 | RBAC Roles | `GET /admin/roles` | `roles`, permissions | admin 200 / teacher 403 | PASS | PASS (read-only by design) | **PASS** |

Live read matrix script: `backend/scripts/audit_admin_modules.py` (26/26 PASS after correcting attendance to send `date=`).

---

## 3. Frontend ↔ backend mapping (summary)

| Area | Flag (defaults with auth) | Primary routes |
|---|---|---|
| Dashboard | `VITE_USE_API_DASHBOARD` | `GET /api/v1/admin/dashboard` |
| Admissions | `VITE_USE_API_ADMISSIONS` | `/admissions`, `/admissions/enquiries` |
| Students | students flag | `GET /students` |
| Employees | `VITE_USE_API_EMPLOYEES` | `GET /hr/portal/employees`, `GET /admin/users` |
| Class Details | `VITE_USE_API_CLASSES` | `/masters/classes`, `/masters/sections`, … |
| Admin Attendance | `VITE_USE_API_ADMIN_ATTENDANCE` | `GET /attendance?date=`, `GET /hr/attendance` |
| Activities | `VITE_USE_API_ACTIVITIES` | `/activities` |
| Documents | `VITE_USE_API_DOCUMENTS` | `/documents/students\|employees` |
| Tasks | `VITE_USE_API_TASKS` | `/tasks` (on escalations router) |
| Leave | `VITE_USE_API_LEAVE` | `/leave-requests` |
| Announcements | `VITE_USE_API_ANNOUNCEMENTS` | `/announcements` |
| TC | `VITE_USE_API_TC` | `/tc-requests` |
| Communication | `VITE_USE_API_COMMUNICATION` | `/communication/*` |
| Calendar | `VITE_USE_API_CALENDAR` | `/calendar` |
| Notifications | `VITE_USE_API_NOTIFICATIONS` | `/notifications` |
| Escalations | `VITE_USE_API_ESCALATIONS` | `/escalations` |
| Admin users / roles | `VITE_USE_API_ADMIN_USERS` | `/admin/users`, `/admin/roles` |

Full narrative: `backend/docs/FRONTEND_INTEGRATION.md`.

---

## 4. Database / persistence

| Migration head | Tables used by Admin delivery |
|---|---|
| `0010_communication` | `document_records`, `document_items`, `file_assets`, `announcements` (+ responses/replies), `calendar_events`, `tc_requests`, `activities`, `activity_players`, `conversations`, `conversation_participants`, `messages`, plus existing students/admissions/masters/leave/escalations/tasks/notifications/users |

Persistence verified by: pytest DB fixtures; live API create for activities/TC/communication/announcements earlier today; browser documents upload against real PG.

---

## 5. Bugs identified and fixes in this audit

| Severity | Finding | Action |
|---|---|---|
| Medium (audit false positive) | `GET /attendance` without `date` returns 422 | Not a product bug — FE always sends `date`. Audit script updated. |
| Low (pre-existing UX) | Documents list **Delete** opens “Send Delete Request?” stub (not hard-delete API) | Documented; no UI redesign. Folder/item APIs still support authorised remove where wired on edit flows. |
| Low (product scope) | Roles cannot edit permissions | Intentional; marked Completed as read-only. |
| Low (pre-existing) | Some file downloads historically used `?token=`; documents path uses bearer | Documents path verified bearer; other modules may still use token query — backlog. |
| Info | Backend process has no `--reload` | Operators must restart uvicorn after code changes. |

No Critical/High defects requiring a code change were confirmed in this pass. No schema migration was required (DB already at `0010_communication`).

---

## 6. Security checks performed

| Check | Result |
|---|---|
| Protected routes require Bearer token | PASS (unauthenticated not re-run this pass; suite covers auth) |
| Teacher denied: Dashboard, TC list, Documents, Admin users/roles | PASS (live 403) |
| Teacher denied: activities write | PASS (live 403 on POST) |
| Admin can decide TC / approve activities | PASS (live) |
| Leave/Escalation API mode does not mirror to localStorage | PASS (code inspection + Phase 0 tests) |
| Passwords not returned in list APIs | PASS (suite + admin users design) |
| Upload signature / size limits (documents, announcements, communication) | PASS (pytest) |
| Campus scoping on TC/activities/calendar | PASS (pytest) |

---

## 7. Automated tests

| Suite | Result |
|---|---|
| `python -m pytest tests/ -q` (backend) | **400 passed**, 1 warning (Starlette TestClient deprecation), ~4 m 55 s |
| Live Admin module matrix (`audit_admin_modules.py`) | **26/26 PASS** |
| Live partials verify (`verify_admin_partials_live.py`, earlier) | Activities / TC / Communication / Roles list **PASS** |

Failed: **0**  
Not run in CI this pass: Playwright/e2e suite (none configured).

---

## 8. Frontend build and lint

| Check | Result |
|---|---|
| `npm run build` | **PASS** (~57 s; existing large-chunk warning) |
| ESLint on Admin API wiring + Dashboard/Notification/TC | **0 errors**, 1 warning (`TcRequestApprovalList` exhaustive-deps) |

---

## 9. Browser verification vs NOT RUN

**PASS (earlier 14 Oct, live backend + real DB):** Documents upload/replace/view; Dashboard KPIs; Calendar Upcoming; Announcement list/create/ack/reply; Notifications bell + mark-read; Class Details CRUD; Leave/Escalation/Task/User Creation/Employee DB (prior sessions).

**NOT RUN in this audit session (UI click-through):** Activities add form, TC approve button, Communication compose UI (covered by **live API** create/send/approve instead). Teacher/HR denial in the browser (covered by **live API** 403). Mobile layout.

---

## 10. Remaining blockers / limitations

1. **Roles editing** — not built (product scope).  
2. **Documents list Delete** — Super Admin request stub, not a hard-delete from the list.  
3. **Admin Attendance** — read-only by design; no Admin mark/correct.  
4. **Notification deep-link** — click does not always open the source entity.  
5. **No Admin “all escalations” tab** — API supports broader access; UI is raise/received.  
6. **Other role panels** (Teacher Announcement UI, Parent TC, etc.) — not re-audited this pass.  
7. **Historical VARCHAR/UUID drift** on some admission enquiry columns — documented earlier; not blocking Admin modules audited here.  
8. **Git:** do not push/merge further without approval (this audit did not push).

---

## 11. Changed files this audit

Documentation and audit helpers only (no product code change required):

- `backend/docs/ADMINISTRATOR_MODULE_AUDIT.md` (this file)
- `backend/scripts/audit_admin_modules.py`
- `reports/daily-work-report.md` / `reports/testing-report.md` (updated)
- Role-module Word status (already on `main` at `10ac4fc`)

---

## Evidence commands

```bash
cd backend
python -m pytest tests/ -q
set PYTHONPATH=.
python scripts/audit_admin_modules.py
python scripts/verify_admin_partials_live.py
cd ..
npm run build
```
