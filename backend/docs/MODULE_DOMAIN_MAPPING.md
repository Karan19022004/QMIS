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

## Director (24 modules) — 16 Oct panel audit

Approvals (Mark Entry / Exam Timetable / Request), Notifications, Lesson Plans, and **My Attendance** (`GET /hr/attendance/mine`) are live. Self-only attendance identity = `HrEmployee.user_id` **or** matching `HrEmployee.email` to the signed-in `User`. Demo seed creates auth Users only — **no** matching `HrEmployee` for `director@qmis.edu`, so mine correctly returns `[]` (do not fabricate punches).

| Status | Modules |
|---|---|
| **PASS (API + browser)** | Mark Entry / Exam / Request Approvals, Notifications, Lesson Plans, My Attendance (empty until HR links employee) |
| **DEMO ONLY (no REST)** | Star Ratings SOM/SOY — recommend **new** `staff_ratings` domain (do not reuse `/hr/performance`) |
| **DEMO ONLY (no REST)** | Home Fun Student/Teacher LMS — recommend reuse Teacher `HomeFun` localStorage SoT (as Principal) until a **deliverables** API is designed; Director screens are still independent mocks |

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

## Teacher (30 modules) — 16 Oct panel verification

Teacher reuses shared staff domains (`_STAFF_ACADEMIC` + matrix loops). No `hr.employees.read` / `exams.write` / admin users.

| Sidebar module | Domain | FE | API | Tables | Migration? | Verified |
|---|---|---|---|---|---|---|
| Dashboard | Composed reads | `Teacher/Dashboard` | `/students`, `/attendance`, `/lesson-plans`, `/tasks`, `/leave-requests`, `/notifications`, `/announcements`, `/exams` | shared | No | PASS (16 Oct browser) |
| Class Attendance | Attendance | `ClassAttendance.jsx` | `/attendance` | `student_attendance` | No | PASS |
| Lesson Plan | Lesson plans | MyLessonPlan + submit | `/lesson-plans` | lesson plan + approvals | No | PASS |
| Students List | Students | Teacher StudentsList | `/students` | `students` | No | PASS (campus-wide until assignment SoT exists) |
| Exam | Exams | `ExamSchedule.jsx` (replaced DemoScreens) | `/exams` read | exams | No | PASS (16 Oct) |
| Announcement / Calendar / Communication / Notifications / Escalation / Tasks / Leave | Shared | roleKey=teacher | matching `/api/v1/*` | shared | No | PASS |
| Mark Entry | Marks | Common MarkEntry | `/exams` + `/students` | marks | No | PASS (API wired) |
| Deliverables / stars / timetable / online / books | Portal UI | Teacher pages | — | — | No | PARTIAL (localStorage / static) |
| Biometric / Analytics / My Profile | Demo | DemoScreens | — | — | No | PARTIAL (demo-only) |
| My Attendance | — | static | — | — | No | PARTIAL |
| Parents List | — | static | `/parents` 404 | — | No | PARTIAL (no parents API) |

Sidebar filter map fixed to real link ids (`2→attendance`, `3→lessonPlans`, `5→taskManagement`).

---

## Coordinator (30 modules) — Completed (1 Gap)

Same academic APIs as Teacher plus **`exams.write`**. Biometric remains Gap. FE: `roleKey=coordinator`; Students List / Exam Schedule / Class Attendance aligned with Teacher API screens.

---

## Principal (21 modules) — 16 Oct panel verification

Shared staff APIs with **`exams.write`**, **`calendar.write`**, **`announcements.write`**, **`leave.decide`**, **`hr.employees.read`** (directory only — not `hr.write` / `users.write`). FE: `roleKey=principal`.

| Status | Modules |
|---|---|
| **PASS (API + browser 16 Oct)** | Dashboard (composed), Tasks, Examination Timetable, Student Database (12), Employee Database (17 via `/hr/portal/employees`), Leave, Announcement, Communication, Calendar, Notifications, Escalation |
| **PASS (API; portal SoT)** | Student Allocation, Extended Class, Home Fun Student/Teacher |
| **PARTIAL (UI; no dedicated REST)** | Star Ratings SOM/SOY, Class Timetable, Teacher Allocation, My Attendance |

---

## HR panel — 16 Oct evening demo readiness

FE hydrates via `hrStore` → `/api/v1/hr/*` (portal employees, leave/payroll bundles, list collections). SMTP / WhatsApp **out of scope** (local queue only).

| Area | API | Verified 16 Oct |
|---|---|---|
| Employees / documents | `/hr/portal/employees`, `/hr/documents` | PASS — 17 employees |
| Recruitment | `/hr/jobs`, `/candidates`, `/interviews` | PASS — 5 / 8 / 6 |
| Onboarding | `/hr/offers`, `/onboarding`, `/observations`, `/shadow` | PASS — Appointment sidebar link added |
| Attendance & leave | `/hr/attendance`, `/hr/leave`, `/leave-requests` | PASS — policies 3 / requests 4 |
| Training / performance | `/hr/training`, `/hr/performance` | PASS |
| Payroll | `/hr/payroll` months + advances/claims | PASS — months 4, claims 2 |
| Reports / notifications | hrStore aggregates | PASS when data present |

Empty-campus hydrate now uploads `hrSeed` once (no gateway sends). Claims soft-filled when empty.

---

## Other role panels

| Role panel | Default approach |
|---|---|
| Director | Shared approvals + announcements + calendar (next slice) |
| Account Head / others | Reuse first; migrate only for true new domains |

---

## How to use this file when starting a module

1. Find the sidebar name in the role-module Word sheet.  
2. Search this document for the same feature.  
3. If the domain exists → wire FE + permissions only.  
4. If not → design domain + API first; migrate only if persistence is required.  
5. Update Verified after pytest / live checks.
