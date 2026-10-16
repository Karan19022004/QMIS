# Module → domain → API → table mapping

**Rules:** [`DATABASE_ARCHITECTURE_RULES.md`](DATABASE_ARCHITECTURE_RULES.md)  
**Schema baseline:** Alembic **`0012_students_student_user_id`**, **48** application tables (+ `students.student_user_id`)  
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
| Student self | `students.student_user_id` | `/students/me` | student role |

---

## Administrator (26 modules)

See prior Admin audit — **26/26 PASS** (shared domains above). Word sheet Admin Completed.

---

## PRM — Front Office (21 modules) — 21/21 Completed (regression 15–16 Oct 2026)

Gate passes / transfer / re-enrollment on `front_office_records` (Alembic **0011**). API: `/api/v1/front-office/{collection}`.

| Collection | CRUD (Admin/PRM write) | Evidence |
|---|---|---|
| `student-gate-passes` | list/create/get/update/delete | Live regression + pytest |
| `hostel-gate-passes` | list/create/get/update/delete | Live regression + pytest |
| `material-gate-passes` | list/create/get/update/delete | Live regression + pytest; FE list hydrate fixed |
| `goods-received-passes` | list/create/get/update/delete | Live regression + pytest; FE list hydrate fixed |
| `student-transfers` | list/create/get/update/delete | Live regression + pytest; browser list verified |
| `student-re-enrollments` | list/create/get/update/delete | Live regression + pytest; FE list hydrate fixed |

**RBAC (verified):** Admin/PRM write; Principal/Director `frontoffice.read` only; Teacher 403; unauth 401.  
**Seed:** `prm@qmis.edu` / `prm12345` (demo). Shared admissions/enquiries remain on `/api/v1/admissions*`.  
**Limitation:** Transfer list default date filters can hide older rows until Clear Filters.

---

## Director (24 modules) — gap (next panel)

Word baseline: **Completed 3 · Partial 3 · Gap/Not Completed 18**.  
Shared already: Tasks, Escalation (API). Partial: Student DB, Leave.  
**Recommended first task:** wire Director **Exam Timetable Approvals** to `/exams` + `/approvals` (backend decide path exists; UI still demo).

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

## Student (23 modules) — Completed

Student portal reuses `StudentPortalRoutes` with `roleKey=student` and `ActiveStudentContext` hydrated from `GET /students/me` (`students.student_user_id`, Alembic **0012**). Optional student login on enroll (`student_account_email` / `student_account_password`).

| Sidebar module | Domain | FE | API | Tables | Migration? | Verified |
|---|---|---|---|---|---|---|
| Class > Online / Extended / Timetable | Portal UI | Student class pages | — | — | No | PASS (portal) |
| Class > Attendance List | Attendance | `AttendanceDetails` | `/attendance/students/{id}/calendar` | `student_attendance` | No | PASS |
| Exam Result | Results | `ResultDetails` | `/results/students/{id}` | exams/marks | No | PASS |
| Exam Schedule | Portal UI | ExamSchedule | exams.read | exams | No | PASS (portal) |
| Deliverables ×3 | Portal UI | Teacher deliverables viewMode=student | — | — | No | PASS (portal) |
| Star Ratings | Portal UI | ViewRatings | — | — | No | PASS (portal) |
| Library / Bus Route / Track Bus / Hostel | Portal UI | Student pages | — | — | No | PASS (portal) |
| Payment Details ×3 | Portal UI | Student payment pages | — | — | No | PASS (portal; no student fee ledger) |
| Announcement | Announcements | roleKey=student | `/announcements` | announcement tables | No | PASS |
| TC Request | TC | Student TC pages | `/tc-requests` | `tc_requests` | No | PASS |
| Communication | Communication | roleKey=student | `/communication/*` | conversation tables | No | PASS |
| Calendar | Calendar | roleKey=student | `/calendar` | `calendar_events` | No | PASS |
| Notifications | Notifications | API list view | `/notifications` | `notifications` | No | PASS |
| Escalation Management | Escalations | roleKey=student | `/escalations` | `escalations` | No | PASS |

**Student permissions:** same non-staff bundle as Parent (`results.read`, `notifications.read`, `attendance.read`, `exams.read`, plus calendar/announcements/communication/tc).

---

## Teacher (30 modules) — Completed (1 Gap)

Teacher reuses shared staff domains (`_STAFF_ACADEMIC` + matrix loops). Biometric remains Gap.

| Sidebar module | Domain | FE | API | Tables | Migration? | Verified |
|---|---|---|---|---|---|---|
| Class Attendance | Attendance | `ClassAttendance.jsx` | `/attendance` | `student_attendance` | No | PASS |
| Lesson Plan | Lesson plans | MyLessonPlan + submit | `/lesson-plans` | lesson plan + approvals | No | PASS |
| Students List | Students | Teacher StudentsList | `/students` | `students` | No | PASS |
| Exam | Exams | ExamSchedule | `/exams` | exams | No | PASS |
| Announcement / Calendar / Communication / Notifications / Escalation / Tasks / Leave | Shared | roleKey=teacher | matching `/api/v1/*` | shared | No | PASS |
| Deliverables / stars / timetable / online / books / profile | Portal UI | Teacher pages | — | — | No | PASS (portal) |
| Biometric Attendance | — | placeholder | — | — | No | Gap |

---

## Coordinator (30 modules) — Completed (1 Gap)

Same academic APIs as Teacher plus **`exams.write`**. Biometric remains Gap. FE: `roleKey=coordinator`; Students List / Exam Schedule / Class Attendance aligned with Teacher API screens.

---

## Principal (21 modules) — 16 Completed / 5 Partial (15 Oct build)

Shared staff APIs with **`exams.write`**, **`calendar.write`**, **`announcements.write`**, **`leave.decide`**. FE: `roleKey=principal`.

| Status | Modules |
|---|---|
| **Completed (API)** | Tasks Assign/My, Escalation, Examination Timetable (`/exams`), Student + Employee Database, Leave My/Received, Announcement, Communication, Calendar (read + Add Event write), Notifications |
| **Completed (portal / shared FE SoT)** | Student Allocation, Extended Class (Teacher ExtraClass paths), Home Fun Student/Teacher (Teacher HomeFun SoT) |
| **Partial (UI; no dedicated REST yet)** | Star Ratings SOM/SOY, Class Timetable, Teacher Allocation, My Attendance |

---

## Other role panels

| Role panel | Default approach |
|---|---|
| Director | Shared approvals + announcements + calendar (next slice) |
| HR / Account Head / others | Reuse first; migrate only for true new domains |

---

## How to use this file when starting a module

1. Find the sidebar name in the role-module Word sheet.  
2. Search this document for the same feature.  
3. If the domain exists → wire FE + permissions only.  
4. If not → design domain + API first; migrate only if persistence is required.  
5. Update Verified after pytest / live checks.
