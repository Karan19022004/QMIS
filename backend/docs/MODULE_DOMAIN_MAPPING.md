# Module → domain → API → table mapping

**Rules:** [`DATABASE_ARCHITECTURE_RULES.md`](DATABASE_ARCHITECTURE_RULES.md)  
**Schema baseline:** Alembic **`0011_front_office_records`**, **48** application tables  
**Legend:** Shared = reuse across roles · Role-specific = domain owned by that panel · Verified = PASS / PARTIAL / NOT RUN

Migration required? **No** means use existing tables; **Yes** only when a new domain needs persistence.

---

## Shared domains (canonical)

| Domain | Primary tables | Primary API prefix | Permissions (examples) |
|---|---|---|---|
| Auth / users | `users`, `user_profiles`, `roles`, `permissions`, `role_permissions` | `/auth`, `/admin/users`, `/admin/roles` | `auth.me`, `users.*` |
| Masters / classes | `campuses`, `academic_years`, `school_classes`, `sections`, `subjects` | `/masters` | `masters.read` |
| Admissions / students | `admission_enquiries`, `admissions`, `students`, `guardians` | `/admissions`, `/students` | `admissions.*`, `students.read` |
| Attendance | `student_attendance` (+ HR attendance in `hr_records`) | `/attendance`, `/hr/attendance` | `attendance.*`, `hr.self` |
| Leave | `leave_requests` | `/leave-requests` | `leave.*` |
| Escalations / tasks | `escalations`, `tasks`, `task_events` | `/escalations`, `/tasks` | `escalations.*`, `tasks.*` |
| Notifications | `notifications` | `/notifications` | `notifications.read` |
| Announcements | `announcements`, `announcement_responses`, `announcement_replies` | `/announcements` | `announcements.*` |
| Calendar | `calendar_events` | `/calendar` | `calendar.*` |
| Communication | `conversations`, `conversation_participants`, `messages` | `/communication` | `communication.*` |
| TC | `tc_requests` | `/tc-requests` | `tc.*` |
| Activities | `activities`, `activity_players` | `/activities` | `activities.*` |
| Documents | `document_records`, `document_items`, `file_assets` | `/documents` | `documents.*` |
| HR employees | `hr_employees`, `hr_records` | `/hr` | `hr.*` |
| Finance (light) | `finance_records` | `/finance` | `finance.*` |
| Approvals / exams / lessons | `approval_*`, `exams`, `marks_*`, `lesson_plans`, … | `/approvals`, `/exams`, `/lesson-plans` | role-gated |
| Front Office campus ops | `front_office_records` | `/front-office/{collection}` | `frontoffice.*` |
| Audit trail | `audit_logs` | (middleware + `/audit`) | `audit.read` |
| Parent children | `students.parent_user_id` | `/parents/me/children` | parent role |

---

## Administrator (26 modules)

See prior Admin audit — **26/26 PASS** (shared domains above). Word sheet Admin Completed.

---

## PRM — Front Office (21 modules)

See prior PRM map — **21/21 Completed**. Gate passes / transfer / re-enrollment on `front_office_records` (`0011`).

---

## Parent (23 modules) — Completed

Parent portal reuses `StudentPortalRoutes` with `roleKey=parent` and `ActiveStudentContext` (Select Child via `GET /parents/me/children`).

| Sidebar module | Domain | FE | API | Tables | Migration? | Verified |
|---|---|---|---|---|---|---|
| Dashboard | Parent UI | `ParentDashboard.jsx` | children + local summary | `students` | No | PASS |
| Class > Online / Extended / Timetable | Portal UI | Student class pages | — | — | No | PASS (portal) |
| Class > Attendance List | Attendance | `AttendanceDetails` | `/attendance/students/{id}/calendar` | `student_attendance` | No | PASS |
| Exam Result | Results | `ResultDetails` | `/results/students/{id}` | exams/marks | No | PASS |
| Exam Schedule / Analytics | Portal UI | ExamSchedule / DemoScreens | exams.read | exams | No | PASS (portal) |
| Deliverables ×3 | Portal UI | Teacher deliverables viewMode=student | — | — | No | PASS (portal) |
| Library / Track Bus / Hostel | Portal UI | Student pages | — | — | No | PASS (portal) |
| Fees Payment ×3 | Portal UI | Student payment pages | — | — | No | PASS (portal; no parent fee ledger) |
| Announcement | Announcements | roleKey=parent | `/announcements` | announcement tables | No | PASS |
| TC Request | TC | Student TC pages | `/tc-requests` | `tc_requests` | No | PASS |
| Communication | Communication | roleKey=parent | `/communication/*` | conversation tables | No | PASS |
| Calendar | Calendar | roleKey=parent | `/calendar` | `calendar_events` | No | PASS |
| Notifications | Notifications | API list view | `/notifications` | `notifications` | No | PASS |
| Escalation Management | Escalations | roleKey=parent UI | local / no parent write path | `escalations` | No | PASS (portal UI) |

**Parent permissions:** `results.read`, `notifications.read`, `attendance.read`, `exams.read`, plus shared calendar/announcements/communication/tc from matrix loops.

---

## Other role panels

| Role panel | Default approach |
|---|---|
| Student | Same shared domains as Parent where applicable |
| Teacher / Coordinator | Academics already partly in DB |
| Principal / Director | Shared approvals + announcements + calendar |
| HR / Account Head / others | Reuse first; migrate only for true new domains |

---

## How to use this file when starting a module

1. Find the sidebar name in the role-module Word sheet.  
2. Search this document for the same feature.  
3. If the domain exists → wire FE + permissions only.  
4. If not → design domain + API first; migrate only if persistence is required.  
5. Update Verified after pytest / live checks.
