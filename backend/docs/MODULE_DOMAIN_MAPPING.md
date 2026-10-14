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

---

## Administrator (26 modules)

| Sidebar module | Domain | FE (service / area) | API | Tables | Migration? | Verified |
|---|---|---|---|---|---|---|
| Dashboard | Shared aggregates | `dashboardApi.js` | `GET /admin/dashboard` | (counts over existing) | No | PASS |
| Admissions Enquiry | Admissions | `admissionsApi.js` | `/admissions/enquiries` | `admission_enquiries` | No | PASS |
| Admission List | Admissions | `admissionsApi.js` | `/admissions` | `admissions` | No | PASS |
| Student Database | Students | `studentsApi.js` | `/students` | `students` | No | PASS |
| Employee Database | HR | `employeeDirectoryApi.js` | `/hr/portal/employees`, `/admin/users` | `hr_employees`, `users` | No | PASS |
| Class Details | Masters | `classDetailsApi.js` | `/masters/classes\|sections` | `school_classes`, `sections` | No (`0004`) | PASS |
| Attendance Students | Attendance | `adminAttendanceApi.js` | `GET /attendance` | `student_attendance` | No | PASS (read) |
| Attendance Employees | HR | `adminAttendanceApi.js` | `GET /hr/attendance` | `hr_records` | No | PASS (read) |
| Activities (×4) | Activities | `activitiesApi.js` | `/activities` | `activities`, `activity_players` | No (`0009`) | PASS |
| Documents Student/Employee | Documents | `documentsApi.js` | `/documents/*` | `document_*`, `file_assets` | No (`0005`) | PASS |
| Tasks Assign / Assigned | Tasks | `taskApi.js` | `/tasks` | `tasks` | No | PASS |
| Leave My / Received | Leave | `leaveApi.js` | `/leave-requests` | `leave_requests` | No | PASS |
| Announcement | Announcements | `announcementsApi.js` | `/announcements` | announcement tables | No (`0006`) | PASS |
| TC Request Approval | TC | `tcApi.js` | `/tc-requests` (+ decide) | `tc_requests` | No (`0008`) | PASS |
| Communication | Communication | `communicationApi.js` | `/communication/*` | conversation tables | No (`0010`) | PASS |
| Calendar | Calendar | `calendarApi.js` | `/calendar` | `calendar_events` | No (`0007`) | PASS |
| Notifications | Notifications | `notificationsApi.js` | `/notifications` | `notifications` | No | PASS |
| Escalation Management | Escalations | `escalationApi.js` | `/escalations` | `escalations` | No | PASS |
| RBAC User Creation | Auth | `adminUsersApi.js` | `/admin/users` | `users`, `user_profiles` | No | PASS |
| RBAC Roles | Auth | `adminUsersApi.js` | `GET /admin/roles` | `roles`, … | No | PASS (read-only) |

---

## PRM — Front Office (21 modules)

| Sidebar module | Domain | FE | API | Tables | Migration? | Verified |
|---|---|---|---|---|---|---|
| Admission Enquiry / List | Admissions (shared) | FrontOffice + `admissionsApi.js` | `/admissions*` | admissions tables | No | PASS |
| Student Database | Students (shared) | FrontOffice students | `/students` | `students` | No | PASS |
| Teacher Database | HR (shared, filtered) | `EmployeeDatabaseListView` | `/hr/portal/employees` | `hr_employees` | No | PASS (read) |
| Student Transfer | Front Office | `StudentTransfer.jsx`, `AddStudentTransfer.jsx`, `studentTransferData.js` | `/front-office/student-transfers` | `front_office_records` | No (`0011`) | PASS (create+list live `STR-*`; pytest) |
| Student Re-Enrollment | Front Office | `AddStudentReEnrollment.jsx`, `studentReEnrollmentData.js` | `/front-office/student-re-enrollments` | `front_office_records` | No (`0011`) | PASS (FE wired; API) |
| TC Request | TC (shared) | FrontOffice TC + `tcApi.js` | `/tc-requests` (+ forward / reject-prm) | `tc_requests` | No | PASS |
| Student Gate Pass | Front Office | `AddGatePass.jsx`, `gatePassData.js` | `/front-office/student-gate-passes` | `front_office_records` | No (`0011`) | PASS (await+API) |
| Hostel Gate Pass | Front Office | `AddHostelGatePass.jsx`, `EditHostelGatePass.jsx`, `hostelGatePassData.js` | `/front-office/hostel-gate-passes` | `front_office_records` | No (`0011`) | PASS (await create/update; live `HGP-0001`; pytest) |
| Material Gate Pass | Front Office | `AddMaterialGatePass.jsx`, `EditMaterialGatePass.jsx`, `materialGatePassData.js` | `/front-office/material-gate-passes` | `front_office_records` | No (`0011`) | PASS (await create/update; live `MGP-0001`; pytest) |
| Goods Received Pass | Front Office | `AddGoodsReceivedPass.jsx`, `EditGoodsReceivedPass.jsx`, `goodsReceivedPassData.js` | `/front-office/goods-received-passes` | `front_office_records` | No (`0011`) | PASS (await create/update; live `GRP-0001`; pytest) |
| Tasks / Leave / Escalation | Shared workflows | Common Task/Leave/Escalation | existing | existing | No | PASS |
| My Attendance | HR self | `MyAttendance.jsx` | `GET /hr/attendance` | `hr_records` | No | PASS (API) |
| Announcement / Communication / Calendar / Notifications | Shared | Common pages `roleKey=prm` | existing | existing | No | PASS |

### PRM verification notes (14 Oct 2026)

- Baseline re-checked: Alembic `0011`, **48** app tables = SQLAlchemy models (plus `alembic_version`).
- Student Transfer **Add** form persists via `addStudentTransfer` → `POST /front-office/student-transfers`.
- Hostel Gate Pass Add/Edit `await` create/update → `/front-office/hostel-gate-passes`.
- Material Gate Pass Add/Edit `await` create/update → `/front-office/material-gate-passes`.
- Goods Received Pass Add/Edit `await` create/update → `/front-office/goods-received-passes`.
- Word status: PRM **21/21 Completed** (`QMIS-ERP-Role-Module-Status.docx` + `.updated.14oct-prm.docx` + `.review.14oct.docx`).
- **Next:** choose next role panel after PRM (reuse-first per architecture rules).

---

## Parent (23 modules) — in progress

| Sidebar module | Domain | FE | API | Tables | Migration? | Verified |
|---|---|---|---|---|---|---|
| TC Request | TC (shared) | Student portal TC pages (used under `/parent`) | `/tc-requests` create/list/get | `tc_requests` | No (`0008`) | PASS (parent scoped; pytest) |
| Escalation Management | Escalations | Student portal escalation pages | existing | `escalations` | No | PASS (sheet already Completed; parents have no escalation write path by design) |
| Announcement / Communication / Calendar / Notifications | Shared | Still `roleKey=student` wrappers in StudentPortalRoutes | existing | existing | No | NOT RUN (next Parent shared-domain wiring) |
| Class / Evaluation / Fees / Library / Transport / Hostel | Student portal demos / Partial | StudentPortalRoutes | partial | various | Only if new persistence needed | NOT RUN / Partial on sheet |

### Parent verification notes (14 Oct 2026)

- Select Child already uses `GET /parents/me/children` when API auth is on.
- TC: parent create/list scoped to linked children; forward/reject-prm blocked for parent.
- Word: Parent TC Request → **Completed**; sheet recount after script.

## Other role panels (480 − Admin − PRM − Parent in progress)

Remaining sidebar rows **must follow the reuse rule** before any migration.

| Role panel | Modules (sheet) | Default approach |
|---|---|---|
| Super Admin | 40 | Mostly shared Admin + broader permissions; reuse Admin domains |
| Student | 23 | Same shared domains as Parent where applicable |
| Teacher / Coordinator | 30 each | Academics (lesson plans, marks, attendance) already partly in DB |
| Principal / Director | 21 / 24 | Shared approvals + announcements + calendar; extend permissions |
| HR | 35 | Prefer `hr_employees` / `hr_records`; new tables only for true payroll gaps |
| Account Head | 22 | Prefer `finance_records`; dedicated books tables only when required |
| Librarian … Quality Auditor | (rest) | Inventory/audit/transport: design domain first, migrate only if needed |

When a panel is completed, append a section here in the same table format as Administrator / PRM.

---

## How to use this file when starting a module

1. Find the sidebar name in the role-module Word sheet.  
2. Search this document (and shared domains above) for the same feature.  
3. If the domain exists → wire FE + permissions only.  
4. If not → write a short domain note, then models + Alembic **only if** data must persist.  
5. Update this file’s Verified column after pytest / live / browser checks.
