# QMIS ERP â€” Priority API Backlog

Mapped from:

- `School_ERP_Frontend_Handoff (1).pdf` (frontend reality)
- Architecture roadmap (business rules)
- Current code under `ERP-dev/backend/app`

**Status key:** `DONE` Â· `NEXT` Â· `PLANNED` Â· `LATER`

---

## Folder map (where code goes)

| Area | Models | Schemas | Services | Endpoints |
|---|---|---|---|---|
| Auth / me | `models/user.py` | `schemas/auth.py` | `services/auth_service.py` | `api/v1/endpoints/auth.py` |
| Roles / RBAC | `models/role.py` | `schemas/rbac.py` | `services/rbac_service.py` | `api/v1/endpoints/rbac.py` |
| Campus / masters | `models/campus.py` | `schemas/masters.py` | `services/masters_service.py` | `api/v1/endpoints/masters.py` |
| Admissions | `models/admission.py` | `schemas/admission.py` | `services/admission_service.py` | `api/v1/endpoints/admissions.py` |
| Students / UIS | `models/student.py` | `schemas/student.py` | `services/student_service.py` | `api/v1/endpoints/students.py` |
| HR | `models/hr_*.py` | `schemas/hr.py` | `services/hr_*.py` | `api/v1/endpoints/hr.py` |
| Finance | `models/finance_*.py` | `schemas/finance.py` | `services/finance_*.py` | `api/v1/endpoints/finance.py` |
| Academics | `models/academic_*.py` | `schemas/academic.py` | `services/academic_*.py` | `api/v1/endpoints/academic.py` |
| Ops / transport | `models/ops_*.py` | `schemas/ops.py` | `services/ops_*.py` | `api/v1/endpoints/ops.py` |
| Audit | `models/audit_*.py` | `schemas/audit.py` | `services/audit_*.py` | `api/v1/endpoints/audit.py` |

Register every new router in `app/api/v1/router.py`.

---

## Phase 0 â€” Foundation (start here)

| ID | API / task | Frontend need | Status | Owner |
|---|---|---|---|---|
| P0-1 | PostgreSQL + `campus_id` on all tables | Multi-campus ready | DONE | You |
| P0-2 | `POST /api/v1/auth/login` (password/OTP later) | Replace fake OTP | DONE | You |
| P0-3 | `GET /api/v1/auth/me` (+ permissions) | Session / profile | DONE | You |
| P0-4 | `POST /api/v1/auth/otp/challenge` + `verify` | Sign-in flow | DONE | You |
| P0-5 | Roles seed (25 frontend roles + MD later) | Select profile / RBAC | DONE | You |
| P0-6 | Permission matrix CRUD | Admin RBAC screens | PARTIAL â€” `rbac.py` exists but is NOT mounted in `main.py`; matrix is code-defined | You |
| P0-7 | Immutable system audit log middleware | Architecture Rule 5 | PARTIAL â€” explicit `write_audit` calls only; `AuditMiddleware` not mounted; no IP/role/before-after | You |
| P0-8 | File upload stub `POST /api/v1/files` | Documents / attachments | DONE | You |
| P0-9 | Masters: classes, sections, subjects, academic year | Admin / Teacher forms | DONE | You |

> P0-9: academic-years + **financial-years (Aprâ€“Mar, separate)**, sections, classes, subjects. Seed AY `2026-27` and FY `FY 2026-27`.  
> Phase 1: Finance Head (`accounthead`) vs Assistant (`finance_assistant`) permission split; fee structure validation on snapshot save.

---

## Phase 1 â€” Identity journey (after Phase 0)

| ID | API | Frontend screens | Status | Owner |
|---|---|---|---|---|
| P1-1 | Enquiry CRUD | PRM / Admin admission enquiry | DONE | You |
| P1-2 | Admission CRUD + convert | Add admission | DONE | You |
| P1-3 | Enroll â†’ student + guardian + parent user | Enroll action | DONE | You |
| P1-4 | `GET /api/v1/parents/me/children` | Parent select-child | DONE | You |
| P1-5 | Student list & detail | Shared student database | DONE | You |

> Running stack today: enquiry â†’ convert â†’ admission CRUD â†’ enroll (+ parent user) â†’ `GET /parents/me/children` â†’ `GET /students` + `GET /students/{id}`. Frontend: `VITE_USE_API_ADMISSIONS=true` (also enables students SoT), `parentsApi.js`, `studentsApi.js`, Student Database list/detail hydrate from API. Soft-delete enquiry = status `In Active` (no hard DELETE).

> Phase 1 closed. Phase 2 started with **Y-1 Attendance DONE**.

---

## Phase 2 â€” Parallel tracks

### You (core + academics + finance shell)

| ID | Area | Key APIs | Status |
|---|---|---|---|
| Y-1 | Attendance | `GET/POST /api/v1/attendance`, calendar map | DONE |
| Y-0 | Approval engine + in-app notifications (prerequisite of Y-2/Y-3) | `POST /approvals`, `GET /approvals/inbox|mine|lookup|{id}`, `POST /approvals/{id}/decide`, `GET /notifications`, `POST /notifications/{id}/read` | DONE |
| Y-2 | Lesson plans (monthly; chain Coordinatorâ†’Principalâ†’Director; deadline 25th; reminders; lock + versioning) | `POST/GET /lesson-plans`, `GET/PATCH /lesson-plans/{id}`, `POST â€¦/submit`, `POST â€¦/revise`, `POST /lesson-plans/reminders/run` | DONE |
| Y-3 | Exams + marks + results (exam types, DA-approved exam schedule, marks batches, chain Coordinatorâ†’Principalâ†’Director then publish, ranks, weightage) | `GET/POST /exam-types`, `POST/GET /exams`, `POST /exams/{id}/submit`, `GET /exams/{id}/results`, `GET/PUT /exam-weightage`, `POST/GET /marks-batches`, `PUT â€¦/entries`, `POST â€¦/submit|revise`, `GET /results/students/{id}` | DONE |
| Y-4 | Leave + permission requests (dept head → HR, permission max 2h, on-leave lookup for attendance) | `POST/GET /leave-requests`, `GET /leave-requests/{id}`, `POST …/decide`, `GET /leave-requests/on-leave` | DONE |
| Y-5 | Escalations with 24h clock + Tasks | `POST/GET /escalations` (box mine/received/all), `GET /escalations/{id}`, `POST /escalations/{id}/status`, `POST /escalations/sla-sweep` (admin); `POST/GET /tasks` (box mine/assigned/all), `GET /tasks/{id}`, `POST /tasks/{id}/status`, `GET /tasks/assignees` | DONE (backend; clock runs on list reads + sweep, no scheduler yet) |
| Y-6 | Fee structures + collection + books + actions | Account Head â€” **DONE** (snapshot + finance actions) |

### Partner (HR â€” full vertical) â€” DONE on this stack

| ID | Area | Status |
|---|---|---|
| H-1 | Employees + staff user create | DONE |
| H-2 | Documents metadata + file upload stub | DONE |
| H-3 | Recruitment (jobs, candidates, interviews) | DONE |
| H-4 | Onboarding / offers / observation / shadow | DONE |
| H-5 | Attendance / leave / balances / permission | DONE |
| H-6 | Payroll / advances / claims / incentives | DONE |
| H-7 | Performance / training / disciplinary / exit / announcements | DONE |

Cross-module links done: HR paid payroll â†’ Finance OUT voucher; HR staff-child concession â†’ Finance apply action.  
Deferred outside closeout: RFID punches, production SMTP / WhatsApp / gateway keys, Academics substitution.

---

### Academics collections (17 Oct 2026)

| ID | Area | Key APIs | Status |
|---|---|---|---|
| Y-7 | Class timetables + teacher allocations + TT change requests | `GET/PUT /api/v1/academics/{class-timetables\|teacher-allocations\|class-timetable-change-requests}` · table `academics_records` · migration `0013` | DONE |

## Phase 3+ â€” Later

Ops (stores, IT, transport, gate), Audit automation, MD cockpit, Paytm, WhatsApp, eSSL, GPS.

---

## Acceptance checks (every module)

- [ ] Deep link + refresh works with real token  
- [ ] Cross-role URL rejected by API (not only frontend redirect)  
- [ ] Forbidden IDs return 403/404  
- [ ] Parent cannot access unrelated child  
- [ ] No business source-of-truth left in browser storage  
- [ ] Every write has `campus_id` + audit log row  
