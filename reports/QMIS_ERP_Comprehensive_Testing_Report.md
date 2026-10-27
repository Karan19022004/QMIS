# QMIS ERP — Comprehensive Testing Report

**Queen Mira International School — School ERP (QMIS ERP)**
**Focus:** Academic Management, from admission to year-end promotion

| | |
|---|---|
| Document | QMIS ERP Comprehensive Testing Report |
| Version | 1.0 |
| Prepared on | 27 October 2026 |
| Code baseline | Branch `main`, last commit `457aedb`, plus uncommitted changes made on 27 Oct 2026 (not yet committed or pushed) |
| Companion document | `QMIS_ERP_Academic_Workflow_and_Testing_Guide.md` (same folder) |
| Earlier evidence used | `reports/testing-report.md`, `reports/daily-work-report.md`, `QMIS_ERP_ACADEMIC_MODULE_USER_GUIDE_AND_FLOW_AUDIT.md` (repository root) |
| Audience | School management, testers, developers |

> **How to read this report.** Every status below is backed by a piece of evidence (an automated test, an API check, a browser observation, or a code reading). Anything without evidence is marked **Pending verification**. Nothing here is claimed as "100% tested" or "production-ready".

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Status legend and evidence codes](#2-status-legend-and-evidence-codes)
3. [Test environment](#3-test-environment)
4. [Testing methodology](#4-testing-methodology)
5. [Academic module test coverage](#5-academic-module-test-coverage)
6. [Detailed test cases](#6-detailed-test-cases)
7. [Defect and risk register](#7-defect-and-risk-register)
8. [Regression and release checklist](#8-regression-and-release-checklist)
9. [Readiness classification](#9-readiness-classification)
10. [Open decisions and dependencies](#10-open-decisions-and-dependencies)
11. [Evidence index](#11-evidence-index)
12. [Glossary](#12-glossary)
13. [Final acceptance checklist](#13-final-acceptance-checklist)

---

## 1. Executive summary

### 1.1 Purpose of testing

To show the school, with evidence, which parts of the Academic Management workflow work today, which parts only work on the server side, and which parts are missing or broken. It also gives repeatable test cases, so the school and testers can confirm the results themselves.

### 1.2 Application scope

QMIS ERP is a web application with separate portals for each school role: Super Admin, Admin, PRM (admissions), Principal, Director, Coordinator, Teacher, Student, Parent and several operations roles. This report covers the **academic** modules:
- academic setup;
- admission and enrolment;
- placement;
- teacher allocation;
- timetables;
- lesson plans;
- class content (homework and learning materials);
- attendance (including biometric);
- examinations, marks and results;
- student and parent views;
- promotion;
- academic notifications.

Finance, HR, transport and operations modules are mentioned only where they touch the academic flow.

### 1.3 Current status at a glance

| Area | Status | Evidence |
|---|---|---|
| Server-side academic workflow (setup → admission → placement → exam → marks → 3-step approval → published result) | **Works**: proven end to end on an isolated test database | Audit API run (A), automated tests (T) |
| Same journey through the screens | **Does not complete.** Marks cannot be published from the screens, so no real result reaches a parent or student | Browser (B): Mark Entry shows "Entry closed"; no Coordinator/Principal marks approval screen (C) |
| Privacy (parent sees only own child; student sees only self; teacher sees only allocated classes) | **Enforced by the server**, with regression tests | T: 26 + 21 + 19 + 14 privacy/access tests |
| Report cards / progress reports | **Not implemented** | C: no route, page, API or table |
| Remedial / improvement workflow | **Not implemented** | C |
| Year-end promotion | **Partially implemented.** Single and bulk ("Select all") promotion to the next grade works, but earlier results are hidden after promotion, and there is no guard against a second promotion in the same year | B (Select all), C, A |

### 1.4 Automated test results (27 Oct 2026)

| Run | Time (IST) | Passed | Failed | Skipped |
|---|---|---|---|---|
| Full backend suite (`pytest tests/`) | evening, final regression | **580** | **0** | 35 |
| Academic-related suites only (21 files, listed in §11.2) | 21:52 | **206** | **0** | 0 |

The 35 skipped tests are PostgreSQL migration tests that need a separate disposable database (`TEST_PG_URL`), which was not available.

### 1.5 Frontend build status

- `npm run build` (Vite production build): **passed** on 27 Oct 2026 (about 1 minute 10 seconds).
- ESLint on the 77 frontend files changed on that day: **no new errors**; 13 files have fewer errors than before. The project still has older lint warnings elsewhere that were not part of this work.

### 1.6 Browser testing status

A **read-only** browser walkthrough was carried out on 27 Oct 2026 for Principal, Admin, PRM, Teacher, Coordinator, Account Head, Student, Parent and Director. Nothing was saved, so that the client demonstration data was not altered. As a result:
- page loading, filters, role menus, scoping and displayed data **were** checked in the browser;
- **creating and saving records through the screens was not browser-tested.** Saving is covered by automated server tests instead and is marked "Implemented, not browser-verified".

### 1.7 Critical defects and release blockers (academic)

| ID | Blocker | Severity |
|---|---|---|
| AC-06 | Marks cannot be published from the screens: Mark Entry is closed by a browser-side closure rule, and no Coordinator or Principal screen can approve a marks batch, although the server requires both before the Director | Critical |
| AC-08 | Examination timetable loses its subject-wise schedule; the Student/Parent "Exam Schedule" shows demo rows, not school exams | High |
| AC-07 | No grading rule or report card; the Student "Exam Result" page shows a hardcoded "Average 80.25 %" summary even with no results | High |
| AC-12 | After promotion, a student's earlier results disappear (results are looked up by the *current* class) | High |
| AC-13 | Class and year are free text in exams and lesson plans; an exam typed "5" never matches "Grade 5" students | High |

### 1.8 Overall readiness (evidence-based)

**Ready for Client Review** of the implemented modules: admission and enrolment, placement and promotion, teacher allocation, timetables, lesson plans, attendance, and the student/parent privacy rules.

**Not ready for full Academic UAT.** The cycle is **blocked at the Examination → Marks → Results stages** (§9).

---

## 2. Status legend and evidence codes

### 2.1 Implementation status

| Status | Meaning |
|---|---|
| **Implemented & verified** | Built, and checked by an automated test or API test **and** seen working in the browser |
| **Implemented, not browser-verified** | Built and proven by automated/API tests, but the screen flow was not exercised in a browser |
| **Partially implemented** | Some of the requirement works; specific parts are missing (listed) |
| **Failed** | Tested and does not meet the requirement |
| **Not implemented** | No screen, API or data for it in the repository |
| **Blocked** | Cannot proceed because of an external integration or a pending school decision |
| **Not tested** | Built (per code) but no test evidence yet: **Pending verification** |

### 2.2 Test case status

**Pass**, **Fail**, **Blocked**, **Not Tested**.

### 2.3 Evidence codes

| Code | Evidence type | Where it is |
|---|---|---|
| **T** | Automated backend test (pytest) | `backend/tests/<file>::<test>`; run results in §1.4 |
| **TS** | Automated "static guard" test that reads frontend source or runs frontend logic in Node | `backend/tests/test_frontend_fixes_static.py`, `test_frontend_student_database_static.py` |
| **A** | API audit run: 102 scripted checks against the real application on a throwaway database | Audit document §1 and §4; script and results kept outside the repository |
| **B** | Browser observation on 27 Oct 2026 (read-only). **B-SS-nn** = screenshot (§11.1); **B-DOM** = page content read without a screenshot | §11.1 |
| **C** | Code inspection (routes, services, models, permissions) | file path given in the row |
| **L** | Read-only query of the development/demo database | Audit §10; row counts after migration 0021 |

---

## 3. Test environment

Only verified information is listed. **No passwords, tokens or secrets are included.**

| Item | Value | Source |
|---|---|---|
| Operating system | Windows, build 10.0.26300 | session environment |
| Frontend | React 19.2, React Router 7.13, Vite 8 (dev server), Tailwind CSS | `package.json` |
| Frontend URL | `http://localhost:5173` (also `http://127.0.0.1:5173`) | running dev server |
| Backend | Python 3.13.2, FastAPI 0.162, SQLAlchemy 2.1, Pydantic 2.14, Alembic 1.20; served by Uvicorn with auto-reload | `backend/.venv` |
| API base URL | `http://127.0.0.1:8000/api/v1` | running backend |
| Database (development / client-demo) | PostgreSQL 18.6, local database `qmis_erp`; contains demo and test-style records, not real student data | `psql --version`; live row counts |
| Database schema version | Alembic head `0021_referrals_notif_reads` (applied 27 Oct 2026 after a verified backup) | `alembic current` |
| Database for automated tests | In-memory SQLite created fresh for each test module, so tests never write to `qmis_erp` | `backend/tests/conftest.py` |
| Environment mode | `ENVIRONMENT=development` | backend configuration (values not printed) |
| Node.js | v24.17.0 | `node -v` |
| Browser used | Cursor IDE built-in browser (Chromium-based; exact version not recorded) on the Windows machine above | — |
| Test tools | pytest 9.1.1; ESLint 9; `npm run build`; a read-only browser session; `pg_dump` / `pg_restore --list` for the backup | — |
| Integrations | Email: SMTP configured and **live** (real emails possible). WhatsApp: not configured. Razorpay: keys empty, so only stub payments. Biometric device import: not connected (simulated only) | backend configuration review (values not printed) |

### 3.1 Test accounts (demo seed; passwords intentionally omitted)

| Role | Login (email) |
|---|---|
| Super Admin | `superadmin@qmis.edu` |
| Admin | `admin@qmis.edu` |
| PRM (admissions) | `prm@qmis.edu` |
| Principal | `principal@qmis.edu` |
| Director | `director@qmis.edu` |
| Coordinator | `coordinator@qmis.edu` |
| Teacher | `teacher@qmis.edu` |
| Account Head | `accounthead@qmis.edu` |
| Parent | `parent@qmis.edu` (linked to one demo child, "Demo Child Sharma", Grade 10-A) |
| Student | `student@qmis.edu` (the same demo child) |

> The sign-in page of the development build lists demo logins for convenience. **This must be switched off before any real deployment** (see the release checklist).

### 3.2 Commands used

```text
backend:   .venv\Scripts\python.exe -m pytest tests/ -q
frontend:  npm run build
lint:      npx eslint <changed files> --format json   (compared with a saved baseline)
database:  pg_dump -Fc  →  pg_restore --list  (backup check), alembic upgrade head
```

Use the project's virtual environment for pytest. The global `python` on this machine has an unrelated `tests` package installed that hides the project's test configuration.

---

## 4. Testing methodology

| Method | What it means here | Done? |
|---|---|---|
| **Unit testing** | Small pieces of logic tested alone. Examples: the fee split maths and grade policy are executed directly; class-name normalisation is covered via API tests | Yes, within the backend suite |
| **API and integration testing** | The real backend application is called the way the screens call it, against a fresh database: sign-in, permissions, saving, reading back | Yes: 580 automated tests plus the 102-check audit script |
| **Frontend component testing** | The project has **no JavaScript test runner**. Instead, "static guard" tests read the React source to make sure fixed bugs cannot silently return, and two frontend calculations are run in Node | Partial (TS) |
| **End-to-end workflow testing** | One automated test (`test_e2e_campus_flow.py`) walks admission → finance. The audit script walked admission → published result on the server. A full screen-based end-to-end run was **not** done | Partial |
| **Role-based access control testing** | Each role is tested for what it may and may not read or change, including tampered record IDs | Yes (T): about 80 access/privacy tests |
| **Database persistence testing** | After saving, the record is read back (and in the audit, re-read after "refresh") | Yes (T, A); live database checked read-only |
| **Validation and negative testing** | Wrong values are refused, e.g. marks above the maximum, duplicate classes, overlapping leave, junior-class student logins | Yes (T) |
| **Regression testing** | The whole suite is re-run after every change, to confirm nothing old broke | Yes: final run 580 passed, 0 failed |
| **Browser compatibility and responsive testing** | Only one browser (Chromium-based) was used, at one desktop width; mobile layouts were not checked | **Not done**: Pending verification |
| **External integration testing** | Email, WhatsApp, Razorpay, biometric and GPS are replaced by stubs in tests; live connections were not exercised (to avoid sending real messages or payments) | **Blocked / not tested** |

---

## 5. Academic module test coverage

| Test ID | Module | Requirement | User role | Test type | Status | Evidence | Remarks |
|---|---|---|---|---|---|---|---|
| COV-01 | Academic year management | Create a year, mark it current; bad dates refused | Admin | API | **Partially implemented** | A (§4 Stage 1); T `test_class_details_api.py::test_an_unknown_academic_year_is_refused_and_nothing_is_created` | Works through the API only. The **Academic Years screen exists but is not routed** (AC-11). Year lists on several screens are hardcoded |
| COV-02 | Class and section management | Create classes and sections with capacity and class teacher; duplicates refused | Admin | API, browser | **Implemented, not browser-verified** (save); list verified | T `test_class_details_api.py` (7 tests); A | Class Details screen is wired to the server; save flow not browser-tested |
| COV-03 | Subject management | Maintain a subject master used by other modules | Admin | API, code | **Partially implemented** | A (create/read pass); C `Pages/Admin/Subjects/*` | Subjects screen is a static mock-up (AC-11). The server list has 1 subject ("English"); Teacher Allocation offers server subjects plus a standard list of six |
| COV-04 | Admission and enrolment | Mandatory fields, enrolment creates student + parent login | Admin, PRM | API, browser | **Implemented, not browser-verified** (save); form verified | T `test_admissions.py` (17 tests); B-DOM (form sections, LKG note) | Class value is not validated against the class master (AC-13) |
| COV-05 | Student login by grade | Pre-KG–Grade 5 parent login only; Grade 6–12 optional student login | Admin, PRM | API, browser | **Implemented & verified** | T `test_admissions.py::test_junior_classes_cannot_get_a_student_login` (6 cases) + seniors (3) + legacy; B-DOM (LKG hides student login) | School decision of 27 Oct 2026; cut-off configurable (`STUDENT_LOGIN_MIN_GRADE`) |
| COV-06 | Student placement and class assignment | Assign section and roll number in current year | Principal, Coordinator (grade band) | API, browser | **Implemented, not browser-verified** (save) | A (place, roll numbers); B-DOM (Coordinator Section Assignment page opens) | Re-placing a placed student is allowed (AC-16). **No automated test** for placement (AC-21) |
| COV-07 | Teacher and subject allocation | Allocate classes/sections/subjects; roster follows allocation | Principal | API, browser | **Partially implemented** | T `test_academic_access_phase2.py::test_allocated_teacher_access_follows_allocation`; B-DOM (real HR teachers listed) | No validation of teacher/class/subject (AC-19); save errors not shown (AC-09). Live: every real teacher is "Not Allocated" |
| COV-08 | Class timetable | Create, filter, approve; portals see approved only | Principal, Coordinator, Director | API, browser | **Partially implemented** | T `test_academics_collections.py`, `test_academic_access_phase3a.py::test_portal_sees_only_approved_timetable_versions`; B-DOM (filters, Director approvals page) | Approval is a status field (Principal can self-approve; AC-10). No clash validation on save |
| COV-09 | Teacher timetable | Teacher sees own periods | Teacher, Coordinator | Code, browser | **Implemented, not browser-verified** (with data) | TS; B-DOM (page renders "no periods match") | Derived view; no Admin/Principal per-teacher timetable page |
| COV-10 | Lesson Plan | Create and submit for approval | Teacher, Coordinator | API, browser | **Implemented, not browser-verified** (submit) | T `test_lesson_plans.py` (7); TS (submit after create); B-SS-03 (tabs) | UI submit was fixed on 27 Oct 2026; screen submission not yet exercised in a browser |
| COV-11 | Lesson Plan Approval | Coordinator → Principal → Director decisions saved | Coordinator, Principal, Director | API | **Partially implemented** | T `test_lesson_plans.py::test_full_approval_then_visibility`, `test_academic_phase4.py`; TS | Director screen now saves decisions. **No Coordinator or Principal approval screen**, so the chain cannot finish from screens (same gap as AC-06) |
| COV-12 | Homework and learning materials (Home Fun, Study Materials, Sample Questions, CA/RCT, Online/Extended Class) | Staff publish; portals see own class/section only | Teacher, Coordinator, Student, Parent | API | **Implemented, not browser-verified** | T `test_academic_access_phase3a.py::test_class_content_scoped_to_childs_class_and_section`, `test_home_fun_submission_details_never_reach_portal` | Stored as flexible JSON collections |
| COV-13 | Student attendance | Mark per day; scoped to class teacher / allocation / substitute duty; audit of changes | Teacher, Coordinator, Principal | API, browser | **Implemented, not browser-verified** (marking) | T `test_attendance_audit.py` (8), `test_academic_access_phase2.py` (attendance cases), `test_academic_phase4.py` (substitute); B-DOM (Teacher sees "No classes are assigned to you") | One mark per student per day (database constraint) |
| COV-14 | Attendance views (student/parent) | Monthly calendar and real totals | Student, Parent | Browser | **Implemented & verified** | B-SS-06; T `test_academic_privacy.py::test_attendance_calendar_scoping` | Hardcoded figures removed on 27 Oct 2026 |
| COV-15 | Biometric attendance integration | Import punches from the device | Teacher, Coordinator | Code, browser | **Blocked** (device import) / **Partially implemented** (manual register) | C (`rfid_import_enabled` unused, no import endpoint); B-DOM (page loads, "No biometric punches") | Simulated only; does not feed class attendance |
| COV-16 | Examination timetable | Exam with subject-wise schedule | Principal, Director | API, browser | **Failed** (subject schedule) / exam header works | A (header, Director approval); C `CreateExaminationTimetable.jsx` (subject rows not sent, type fixed to MIDTERM); B-SS-08 (student schedule shows demo rows) | AC-08 |
| COV-17 | Examination management | Exam approval before marks | Principal, Director | API | **Implemented, not browser-verified** | T `test_exams.py`, `test_academic_access_phase2.py::test_portal_sees_only_approved_exams_for_own_class` | Marks are refused until the exam is approved (A) |
| COV-18 | Marks entry | Enter marks 0..max or absent; save draft; submit | Teacher, Coordinator | API, browser | **Failed in the UI** (blocked); server works | T `test_exams.py::test_marks_validation_and_deny_revise`; B-SS-04 ("Entry closed for Mark Entry") | AC-06a; section/subject not enforced (AC-14) |
| COV-19 | Marks verification and approval | Coordinator → Principal → Director | Coordinator, Principal, Director | API, browser | **Failed in the UI**; server works | T `test_exams.py::test_marks_flow_publish_ranks_and_parent_visibility`, `test_academic_access_phase2.py::test_full_approval_sequence_still_publishes`; B-SS-05 (Director screen, 0 submissions) | AC-06b: no Coordinator/Principal screen |
| COV-20 | Result publication | Third approval publishes; nothing visible before | Director | API | **Implemented, not browser-verified** (server) | T (as above) | Results are calculated on request, not stored |
| COV-21 | Student and parent result views | Own child / self only; correct figures | Student, Parent | API, browser | **Partially implemented** | T `test_academic_privacy.py` (results cases); B-SS-07 | Privacy enforced; page summary block is hardcoded (AC-07) |
| COV-22 | Academic reports and report cards | Printable progress report | — | Code | **Not implemented** | C (no route, page, API or table) | AC-07 |
| COV-23 | Remedial / improvement workflow | Identify, assign, follow up | — | Code | **Not implemented** | C (no matches for remedial/improvement) | — |
| COV-24 | Student promotion | Next grade only; Select all; per-student result | Principal, Coordinator (band) | API, browser | **Partially implemented** | A (promote); B-DOM / B-SS-01 (Select all → "Promote 1 student", target Grade 8); TS | No backend automated test (AC-21); earlier results hidden (AC-12); no same-year duplicate guard (DEF-N03) |
| COV-25 | Year-end academic history | Previous class, marks, attendance kept and visible | Principal, Parent | API, code | **Failed** (results history) | A (Grade 5 result disappears after promotion) | Attendance rows are kept (C); previous class only in the audit log |
| COV-26 | Parent and student notifications (academic) | Notify on timetable, results, attendance | Parent, Student | Code | **Not implemented** | C (no notification calls in exams, attendance, timetable, placement services) | Parents do get fee reminders, payment confirmations and announcements |
| COV-27 | Staff approval notifications | Only eligible approvers notified | Coordinator, Principal, Director | API | **Implemented, not browser-verified** | T `test_academic_access_phase3a.py::test_coordinator_step_notifies_only_in_scope_coordinators` and 2 related | — |
| COV-28 | Notification read status | Reading a role-wide notice marks it only for that person | All | API | **Implemented, not browser-verified** | T `test_notification_reads.py` (2) | Migration 0021 |
| COV-29 | Substitute duty | Time-boxed attendance access for a covering teacher | Principal, Director, Admin | API | **Implemented, not browser-verified** | T `test_academic_phase4.py` (substitute cases) | Migration 0020 |
| COV-30 | Coordinator grade bands | Coordinator acts only inside the band | Principal | API, browser | **Implemented & verified** (scope) | T `test_academic_access_phase2.py::test_coordinator_sees_only_batches_in_grade_band`; B-DOM (Coordinator Promote lists only Grades 4 and 7) | Band screen has no menu link (direct URL) |
| COV-31 | Star of the Month (matrix) | Ratings saved on the server per class | Teacher, Coordinator | API, browser | **Implemented, not browser-verified** (save) | T `test_ops_and_audit_collections.py::test_star_of_month_matrix_records_are_saved_one_class_at_a_time`; B-DOM (matrix loads from server, no sync error) | Matrix results are not yet shown on the star-rating lists |

---

## 6. Detailed test cases

Each case uses the requested fields. Where a test was executed by an automated test, "Actual Result" summarises the observed outcome of the 27 Oct 2026 runs. Where it was not executed, it says **Pending verification**.

### 6.1 Academic setup

| Field | TC-SET-01 |
|---|---|
| Module | Class and section management |
| Objective | A new class defaults to the current academic year and duplicates are refused |
| Preconditions | A current academic year exists |
| Test Role | Admin |
| Test Steps | 1. Create class "Grade 5". 2. Create the same class again. 3. Create a section for an unknown class |
| Expected Result | Step 1 saved under the current year; step 2 refused as a conflict; step 3 refused (404) |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_class_details_api.py::test_a_new_class_defaults_to_the_current_year_and_gets_its_first_section`, `::test_duplicates_are_conflicts_with_a_stable_code_so_a_retry_can_skip_them`, `::test_a_section_for_a_class_that_does_not_exist_is_a_404` |
| Severity | High |

| Field | TC-SET-02 |
|---|---|
| Module | Class and section management (permission) |
| Objective | Only users with masters-write can create classes; others can read |
| Preconditions | Demo logins |
| Test Role | Admin (allowed), Principal (refused) |
| Test Steps | 1. As Principal, create a class. 2. As Principal, list classes |
| Expected Result | 1 refused (403); 2 allowed |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_class_details_api.py::test_only_users_with_masters_write_can_create_but_others_can_read` |
| Severity | High |

| Field | TC-SET-03 |
|---|---|
| Module | Academic year screen |
| Objective | Admin can manage academic years from the menu |
| Preconditions | Admin login |
| Test Role | Admin |
| Test Steps | 1. Look for "Academic Years" in the Admin menu |
| Expected Result | A working Academic Years screen |
| Actual Result | Component exists but is not routed and not in any menu |
| Status | **Fail** |
| Evidence | C (no route for `AcademicYears`); audit AC-11 |
| Severity | Medium |

| Field | TC-SET-04 |
|---|---|
| Module | Subject management |
| Objective | Subjects can be maintained and are used by allocation/timetables |
| Preconditions | Admin login |
| Test Role | Admin |
| Test Steps | 1. Open `/admin/class/subjects`. 2. Add a subject |
| Expected Result | Subject saved to the server and offered in Teacher Allocation |
| Actual Result | The page is a static mock-up; subjects can only be created through the API |
| Status | **Fail** |
| Evidence | C `src/Pages/Admin/Subjects/*`; A (API create pass) |
| Severity | Medium |

### 6.2 Admission and enrolment

| Field | TC-ADM-01 |
|---|---|
| Module | Admission: mandatory fields |
| Objective | First name, mobile number and class are required, and the form says so |
| Preconditions | PRM or Admin login |
| Test Role | PRM |
| Test Steps | 1. Open Add Admission. 2. Save with the three fields empty |
| Expected Result | Save refused; message lists the missing fields; fields highlighted |
| Actual Result | Server refuses missing fields (T). The form shows a message and highlights fields (code; added 27 Oct 2026) |
| Status | **Pass** (server) / **Not Tested** (screen save, Pending verification) |
| Evidence | T `test_admissions.py`; C `AddAdmission.jsx`, `admissionListData.js` |
| Severity | High |

| Field | TC-ADM-02 |
|---|---|
| Module | Admission: student login by grade |
| Objective | Junior classes cannot be given a student login; Grade 6+ can |
| Preconditions | School policy minimum grade = 6 |
| Test Role | Admin |
| Test Steps | 1. Create an LKG admission with a student email and password. 2. Repeat without them. 3. Enrol with student credentials. 4. Enrol with parent only. 5. Repeat for Grade 6 with a student login |
| Expected Result | 1 refused; 2 saved; 3 refused; 4 enrols, no student login; 5 student login created |
| Actual Result | As expected for LKG, UKG, Pre-KG, Grade 1, Grade 5, "V", and Grade 6, Grade 12, "VI" |
| Status | **Pass** |
| Evidence | T `test_admissions.py::test_junior_classes_cannot_get_a_student_login`, `::test_senior_classes_keep_the_optional_student_login`, `::test_older_junior_admission_with_a_saved_student_login_still_enrols_parent_only`; B-DOM (form hides the student login for LKG) |
| Severity | High |

| Field | TC-ADM-03 |
|---|---|
| Module | Admission: student portal login saved on the form |
| Objective | Student email/password saved on the admission survive later edits and are used at enrolment |
| Preconditions | Grade 6 admission |
| Test Role | Admin |
| Test Steps | 1. Save admission with student login. 2. Edit another field without retyping the password. 3. Enrol. 4. Sign in as the student |
| Expected Result | Login kept after edit; student account created; sign-in works |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_admissions.py::test_student_portal_login_saved_on_the_admission_survives_later_edits` |
| Severity | High |

| Field | TC-ADM-04 |
|---|---|
| Module | Admission: duplicate enrolment |
| Objective | An admission cannot be enrolled twice or edited after enrolment |
| Preconditions | Enrolled admission |
| Test Role | Admin |
| Test Steps | 1. Enrol again. 2. Edit the enrolled admission |
| Expected Result | Both refused (409) |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | A (Stage 2); C `services/admissions.py` (`already_enrolled`) |
| Severity | High |

| Field | TC-ADM-05 |
|---|---|
| Module | Admission: class validation |
| Objective | Only classes from the class master are accepted |
| Preconditions | — |
| Test Role | Admin |
| Test Steps | 1. Create an admission for "Grade 55" |
| Expected Result | Refused |
| Actual Result | Accepted |
| Status | **Fail** |
| Evidence | A (AC-13) |
| Severity | High |

| Field | TC-ADM-06 |
|---|---|
| Module | Admission list actions |
| Objective | Enrolled admissions no longer offer Edit/View; open ones do |
| Preconditions | Mixed admissions in the list |
| Test Role | Admin |
| Test Steps | 1. Open Admission List |
| Expected Result | Enrolled rows show "Enrolled"; others show the action menu |
| Actual Result | 8 rows "Enrolled", 2 rows with the menu |
| Status | **Pass** |
| Evidence | B-DOM (27 Oct 2026) |
| Severity | Low |

| Field | TC-ADM-07 |
|---|---|
| Module | Admission referral (record only) |
| Objective | A referral is saved, kept on unrelated edits, listed for the Account Head, and removable |
| Preconditions | — |
| Test Role | Admin; Account Head |
| Test Steps | 1. Create admission with referral. 2. Edit without referral fields. 3. Account Head lists referrals. 4. Clear the referrer name |
| Expected Result | Kept after step 2; listed in step 3; removed in step 4; invalid referrer type refused |
| Actual Result | As expected; Account Head page loads ("No referrals recorded yet" on live data) |
| Status | **Pass** |
| Evidence | T `test_admissions.py::test_referral_is_recorded_kept_on_unrelated_edits_and_listed_for_accounts`; B-DOM |
| Severity | Low |

### 6.3 Placement

| Field | TC-PLC-01 |
|---|---|
| Module | Placement |
| Objective | A pending student is placed into a section and gets the next roll number |
| Preconditions | Enrolled student; class with sections in the current year |
| Test Role | Principal |
| Test Steps | 1. Open pending list. 2. Place into section A. 3. Refresh |
| Expected Result | Status "placed", section A, roll 1 kept after refresh |
| Actual Result | As expected (server) |
| Status | **Pass** (server) / **Not Tested** (screen save) |
| Evidence | A (Stage 3) |
| Severity | High |

| Field | TC-PLC-02 |
|---|---|
| Module | Placement: grade band |
| Objective | A coordinator cannot place students outside their grade band |
| Preconditions | Coordinator band set |
| Test Role | Coordinator |
| Test Steps | 1. Place an out-of-band student |
| Expected Result | Refused (403) |
| Actual Result | As expected (A). Browser: Coordinator Promote page lists only in-band classes (Grades 4 and 7) |
| Status | **Pass** |
| Evidence | A; B-DOM |
| Severity | High |

| Field | TC-PLC-03 |
|---|---|
| Module | Placement: re-placement |
| Objective | An already placed student cannot be silently re-placed |
| Preconditions | Placed student |
| Test Role | Principal |
| Test Steps | 1. Place the same student again |
| Expected Result | Refused or confirmed explicitly; roll numbers stay consistent |
| Actual Result | Allowed; roll number changes (1 → 3) |
| Status | **Fail** |
| Evidence | A (AC-16) |
| Severity | Medium |

| Field | TC-PLC-04 |
|---|---|
| Module | Placement reaches the portals |
| Objective | A placed student sees timetable and attendance, not "Awaiting section assignment" |
| Preconditions | Placed student with a login |
| Test Role | Student, Parent |
| Test Steps | 1. Sign in. 2. Open Timetable and Attendance List |
| Expected Result | Pages show class data |
| Actual Result | Initially **failed** (portal dropped the placement status). After the fix: timetable says "No approved class timetable found…" (correct, none exists for Grade 10-A), attendance shows real October 2026 figures |
| Status | **Pass** (after fix and retest) |
| Evidence | B-SS-06; TS `test_frontend_fixes_static.py::test_portal_profiles_keep_placement_status` |
| Severity | Critical (before fix) |

### 6.4 Teacher allocation and access

| Field | TC-ALC-01 |
|---|---|
| Module | Teacher allocation scope |
| Objective | A teacher's student list and attendance follow their class-teacher section and allocations |
| Preconditions | Teacher with allocation to one section |
| Test Role | Teacher |
| Test Steps | 1. List students. 2. Mark attendance for the allocated section. 3. Try another section |
| Expected Result | Only allocated students; 3 refused |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_academic_access_phase2.py::test_class_teacher_reads_and_marks_own_section`, `::test_allocated_teacher_access_follows_allocation`, `::test_unassigned_teacher_cannot_read_or_mark_and_self_declared_duty_does_not_count`, `::test_identifier_tampering_cannot_widen_teacher_access` |
| Severity | Critical |

| Field | TC-ALC-02 |
|---|---|
| Module | Teacher Allocation roster |
| Objective | Only real HR teachers are offered (no demo teachers) |
| Preconditions | Server connection on |
| Test Role | Principal |
| Test Steps | 1. Open Teacher Allocation |
| Expected Result | HR teachers listed; Director not listed as a teacher |
| Actual Result | As expected after the 27 Oct fix; all teachers "Not Allocated" on live data |
| Status | **Pass** |
| Evidence | B-DOM; TS `test_teacher_roster_never_shows_demo_teachers_in_server_mode` |
| Severity | High |

| Field | TC-ALC-03 |
|---|---|
| Module | Allocation validation |
| Objective | Unknown teacher, class or subject is refused |
| Preconditions | — |
| Test Role | Principal |
| Test Steps | 1. Save an allocation for "Grade 99" / "Alchemy" |
| Expected Result | Refused |
| Actual Result | Accepted |
| Status | **Fail** |
| Evidence | A (AC-19) |
| Severity | Low |

### 6.5 Timetable

| Field | TC-TT-01 |
|---|---|
| Module | Class timetable: portal visibility |
| Objective | Parents/students see only approved timetables for their own class and section |
| Preconditions | Approved and pending timetables for several classes |
| Test Role | Parent, Student |
| Test Steps | 1. Read timetables as parent. 2. Try to reach another class's timetable |
| Expected Result | Only own approved timetable |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_academic_access_phase2.py::test_portal_timetables_limited_to_childs_class_and_section`, `test_academic_access_phase3a.py::test_portal_sees_only_approved_timetable_versions` |
| Severity | High |

| Field | TC-TT-02 |
|---|---|
| Module | Class timetable list filters |
| Objective | Class/section filters match any period, and teacher/status filters work |
| Preconditions | At least one timetable |
| Test Role | Principal |
| Test Steps | 1. Open Class Timetable. 2. Check filter options |
| Expected Result | Year, class, section, teacher, status filters available; 1 entry shown |
| Actual Result | As expected (1 approved timetable CTT999) |
| Status | **Pass** |
| Evidence | B-DOM; TS `test_class_timetable_filters_match_every_period` |
| Severity | Medium |

| Field | TC-TT-03 |
|---|---|
| Module | Timetable approval control |
| Objective | A creator cannot approve their own timetable; approval is recorded |
| Preconditions | Principal-created timetable |
| Test Role | Principal |
| Test Steps | 1. Create timetable. 2. Approve it as the same Principal |
| Expected Result | Separate approver required; approval record kept |
| Actual Result | Self-approval allowed; no approval record |
| Status | **Fail** |
| Evidence | A (AC-10) |
| Severity | Medium |

| Field | TC-TT-04 |
|---|---|
| Module | Timetable conflicts |
| Objective | Two classes cannot be given the same teacher in the same period |
| Preconditions | — |
| Test Role | Principal |
| Test Steps | 1. Create two timetables with the same teacher, day and period |
| Expected Result | Refused, or warned at save |
| Actual Result | No conflict check on save; the teacher's weekly view marks the cell "(clash)" |
| Status | **Fail** (no validation) |
| Evidence | C `classTimetableData.js`, `teacherAssignedClasses.js` |
| Severity | Medium |

### 6.6 Lesson plans

| Field | TC-LP-01 |
|---|---|
| Module | Lesson plan approval chain |
| Objective | Plan goes Coordinator → Principal → Director; order enforced; locked after approval |
| Preconditions | Teacher plan |
| Test Role | Teacher, Coordinator, Principal, Director |
| Test Steps | 1. Create. 2. Submit. 3. Director decides early. 4. Coordinator, Principal, Director approve. 5. Edit |
| Expected Result | 3 refused; 4 approved; 5 refused |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_lesson_plans.py::test_create_edit_submit_and_lock`, `::test_full_approval_then_visibility`; `test_academic_phase4.py::test_teacher_submission_keeps_the_full_chain` |
| Severity | High |

| Field | TC-LP-02 |
|---|---|
| Module | Lesson plan: deny and revise |
| Objective | A denied plan can be revised as a new version |
| Preconditions | Submitted plan |
| Test Role | Teacher, Coordinator |
| Test Steps | 1. Deny. 2. Revise |
| Expected Result | New version created |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_lesson_plans.py::test_deny_then_revise_creates_new_version` |
| Severity | Medium |

| Field | TC-LP-03 |
|---|---|
| Module | Lesson plan screens |
| Objective | Saving a plan from the screen submits it for approval; Director decisions persist after reload |
| Preconditions | Teacher login |
| Test Role | Teacher, Director |
| Test Steps | 1. Add a plan from Lesson Plan → My Submissions. 2. Reload. 3. Director approves. 4. Reload |
| Expected Result | Plan shows "Pending" with an approval in progress; Director decision kept after reload |
| Actual Result | Code fixed and guarded on 27 Oct 2026; **screen save not executed** (read-only browser session) |
| Status | **Not Tested**: Pending verification |
| Evidence | TS `test_lesson_plans_enter_approval_and_decisions_are_saved_on_the_server`; B-SS-03 (tabs only) |
| Severity | High |

| Field | TC-LP-04 |
|---|---|
| Module | Lesson plan: coordinator scope |
| Objective | Coordinators see and approve only plans in their band/allocations |
| Preconditions | Two coordinators with different bands |
| Test Role | Coordinator |
| Test Steps | 1. List plans. 2. Approve an out-of-band plan |
| Expected Result | Out-of-band hidden and refused |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_academic_access_phase3a.py::test_coordinator_lesson_plans_follow_grade_band`, `::test_out_of_scope_coordinator_cannot_submit_or_reach_by_identifier` |
| Severity | High |

### 6.7 Attendance

| Field | TC-ATT-01 |
|---|---|
| Module | Attendance persistence and audit |
| Objective | First mark and every change are stored with old/new values and who changed them |
| Preconditions | Teacher with a section |
| Test Role | Teacher |
| Test Steps | 1. Mark Present. 2. Change to Absent. 3. Change section. 4. Read audit |
| Expected Result | One row per student per day; audit chain shows before/after values |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_attendance_audit.py::test_create_logs_initial_values`, `::test_update_records_previous_and_new_status_and_marker`, `::test_repeated_updates_chain_before_and_after_values` |
| Severity | High |

| Field | TC-ATT-02 |
|---|---|
| Module | Attendance: unauthorized writes |
| Objective | Unauthorized users cannot write attendance or read audit details; failed writes change nothing |
| Preconditions | — |
| Test Role | Unassigned teacher, Parent, Student |
| Test Steps | 1. Mark another class. 2. Read audit details |
| Expected Result | Refused; no change events |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_attendance_audit.py::test_rejected_writes_leave_no_change_events`, `::test_unauthorized_users_cannot_write_or_read_attendance_audit_details`; `test_academic_privacy.py::test_portal_roles_cannot_list_class_attendance` |
| Severity | Critical |

| Field | TC-ATT-03 |
|---|---|
| Module | Substitute duty |
| Objective | A substitute can mark only the assigned class/section during the assigned period; revocation removes access |
| Preconditions | Duty assigned by Principal |
| Test Role | Principal, Teacher |
| Test Steps | 1. Assign duty. 2. Mark inside and outside the window. 3. Revoke |
| Expected Result | Allowed only inside the window; denied after revoke |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_academic_phase4.py::test_valid_substitute_can_read_and_mark_only_during_the_period`, `::test_revocation_removes_access_immediately_and_keeps_history` |
| Severity | High |

| Field | TC-ATT-04 |
|---|---|
| Module | Student attendance page |
| Objective | The page shows real totals for the chosen month |
| Preconditions | Placed student |
| Test Role | Student |
| Test Steps | 1. Open Attendance List |
| Expected Result | Month picker, calendar and computed totals (no fixed numbers) |
| Actual Result | October 2026 shown; totals computed from marks (0 marked) |
| Status | **Pass** |
| Evidence | B-SS-06 |
| Severity | Medium |

| Field | TC-ATT-05 |
|---|---|
| Module | Biometric sync |
| Objective | Sync never wipes server records and reports failures |
| Preconditions | Teacher login |
| Test Role | Teacher |
| Test Steps | 1. Open Biometric. 2. Press Sync with no records |
| Expected Result | Message "No biometric punches to sync…"; nothing deleted |
| Actual Result | Page loads with "No biometric punches recorded yet". Sync not pressed (read-only session); code guarded |
| Status | **Not Tested** (sync): Pending verification |
| Evidence | B-DOM; TS `test_biometric_saves_never_write_an_empty_list_before_loading` |
| Severity | High |

### 6.8 Examinations, marks and results

| Field | TC-EX-01 |
|---|---|
| Module | Exam approval gate |
| Objective | Marks cannot be entered until the exam is approved by the Director |
| Preconditions | Draft exam |
| Test Role | Principal, Director, Teacher |
| Test Steps | 1. Create marks batch on a draft exam. 2. Submit exam. 3. Coordinator decides. 4. Director approves. 5. Create batch |
| Expected Result | 1 refused (409); 3 refused; 5 allowed |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | A (Stage 7); T `test_exams.py::test_marks_flow_publish_ranks_and_parent_visibility` |
| Severity | High |

| Field | TC-EX-02 |
|---|---|
| Module | Exam timetable subjects |
| Objective | Day-wise subject schedule is saved and shown to students |
| Preconditions | Principal login |
| Test Role | Principal, Student |
| Test Steps | 1. Create exam with subject rows. 2. Open Student Exam Schedule |
| Expected Result | Subjects and dates shown for the student's class |
| Actual Result | Subject rows are not sent to the server; the Student page shows demo rows (EXM-1002 "9 - B", EXM-1003, EXM-1006) to a Grade 10-A student |
| Status | **Fail** |
| Evidence | C `CreateExaminationTimetable.jsx` lines 72-78; B-SS-08 |
| Severity | High |

| Field | TC-MK-01 |
|---|---|
| Module | Marks validation |
| Objective | Marks above maximum are refused; draft saves; owner-only edit; locked after submit |
| Preconditions | Approved exam |
| Test Role | Teacher |
| Test Steps | 1. Enter 101/100. 2. Save 88. 3. Another teacher edits. 4. Submit then edit |
| Expected Result | 1 refused; 2 saved; 3 refused; 4 locked (409) |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_exams.py::test_marks_validation_and_deny_revise`; A (Stage 8) |
| Severity | High |

| Field | TC-MK-02 |
|---|---|
| Module | Mark Entry screen |
| Objective | A teacher or coordinator can save and submit marks from the screen |
| Preconditions | Approved exam |
| Test Role | Coordinator |
| Test Steps | 1. Open Mark Entry |
| Expected Result | Form usable |
| Actual Result | Banner "Entry closed for Mark Entry. Save and submit stay blocked until Super Admin approves a re-entry request." The page also says marks go "to the Director", but the server chain is Coordinator → Principal → Director |
| Status | **Fail** (blocked) |
| Evidence | B-SS-04; C `governance.js` (`CLS-0001`, closed from 2026-09-01) |
| Severity | Critical |

| Field | TC-MK-03 |
|---|---|
| Module | Marks approval chain |
| Objective | Coordinator → Principal → Director; out-of-band coordinator refused; publish on the third approval |
| Preconditions | Submitted batch |
| Test Role | Coordinator, Principal, Director |
| Test Steps | 1. Director approves first. 2. Out-of-band coordinator approves. 3. In-band chain approves in order |
| Expected Result | 1 and 2 refused; 3 publishes |
| Actual Result | As expected (server) |
| Status | **Pass** (server) |
| Evidence | T `test_academic_access_phase2.py::test_coordinator_cannot_open_or_approve_out_of_band_batch`, `::test_full_approval_sequence_still_publishes`, `test_academic_phase4.py::test_coordinator_marks_self_submission_routes_to_principal` |
| Severity | Critical |

| Field | TC-MK-04 |
|---|---|
| Module | Marks approval screens |
| Objective | Coordinator and Principal can approve marks from their portals |
| Preconditions | Submitted batch |
| Test Role | Coordinator, Principal |
| Test Steps | 1. Look for a marks approval screen in each menu |
| Expected Result | Screen available |
| Actual Result | Only `/director/mark-entry-approval` exists (0 submissions on live data) |
| Status | **Fail** |
| Evidence | C (routes); B-SS-05 |
| Severity | Critical |

| Field | TC-RS-01 |
|---|---|
| Module | Results privacy |
| Objective | Parent sees own child only; student sees self only; class table closed to portals; teacher limited to assigned students |
| Preconditions | Published results for two families |
| Test Role | Parent, Student, Teacher |
| Test Steps | 1. Parent reads own and other child. 2. Student reads self and other. 3. Portal reads class table. 4. Unassigned teacher reads results |
| Expected Result | Only own data; others refused or empty |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_academic_privacy.py::test_parent_reads_only_linked_child_results`, `::test_student_reads_self_but_not_another_student`, `::test_parents_and_students_cannot_read_class_result_table`, `::test_assigned_teacher_reads_results_unassigned_is_denied`, `::test_tampered_or_unknown_identifiers_reveal_nothing` |
| Severity | Critical |

| Field | TC-RS-02 |
|---|---|
| Module | Results hidden before publication |
| Objective | Nothing is visible to parents before the final approval |
| Preconditions | Submitted, unapproved batch |
| Test Role | Parent |
| Test Steps | 1. Read results before and after the third approval |
| Expected Result | Empty before; visible after |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_exams.py::test_marks_flow_publish_ranks_and_parent_visibility`; A (Stage 9) |
| Severity | Critical |

| Field | TC-RS-03 |
|---|---|
| Module | Student Exam Result page |
| Objective | Page shows only real figures |
| Preconditions | Student with no published results |
| Test Role | Student |
| Test Steps | 1. Open Exam Result |
| Expected Result | Empty state everywhere |
| Actual Result | Table empty, but "Professional Summary" shows "Average 80.25 %" and invented subject counts; result status logic marks every row "Pass" (C) |
| Status | **Fail** |
| Evidence | B-SS-07; C `ResultDetails.jsx` (AC-07) |
| Severity | High |

| Field | TC-RS-04 |
|---|---|
| Module | Report card |
| Objective | A printable report card per student per term |
| Preconditions | — |
| Test Role | Principal, Parent |
| Test Steps | 1. Look for report card / progress report |
| Expected Result | Available |
| Actual Result | Not implemented |
| Status | **Fail** (not implemented) |
| Evidence | C (no route, page, API or table) |
| Severity | High |

### 6.9 Promotion and history

| Field | TC-PRM-01 |
|---|---|
| Module | Promotion screen: Select all |
| Objective | Choose a class, select all, see the target and the button count |
| Preconditions | Placed students |
| Test Role | Principal |
| Test Steps | 1. Open Promote. 2. Choose Grade 7. 3. Tick Select all. 4. Untick (do not promote) |
| Expected Result | Selected count, target class, sections, "Promote N students" button |
| Actual Result | "1 selected", target Grade 8, sections A/B/C, "Promote 1 student" |
| Status | **Pass** (selection) / **Not Tested** (promotion itself in the browser) |
| Evidence | B-DOM; B-SS-01; TS `test_bulk_promotion_is_sequential_and_capped` |
| Severity | High |

| Field | TC-PRM-02 |
|---|---|
| Module | Promotion rules |
| Objective | Only placed students; next grade only; not beyond Grade 12; capacity respected |
| Preconditions | — |
| Test Role | Principal |
| Test Steps | 1. Promote an unplaced student. 2. Promote to Grade+2. 3. Promote a Grade 12 student |
| Expected Result | All refused |
| Actual Result | Rules present in code; promote-to-next-grade executed in the audit; the refusals **have no automated test** |
| Status | **Not Tested** (refusals): Pending verification |
| Evidence | C `services/placement.py::promote_student`; A (one promotion) |
| Severity | High |

| Field | TC-PRM-03 |
|---|---|
| Module | Duplicate promotion |
| Objective | A student cannot be promoted twice in the same academic year |
| Preconditions | Student promoted once |
| Test Role | Principal |
| Test Steps | 1. Promote the same student again |
| Expected Result | Refused |
| Actual Result | Code has no such guard: the target is "current grade + 1", so a second promotion would move the student again. **Not executed** |
| Status | **Not Tested**: suspected defect DEF-N03, Pending verification |
| Evidence | C `services/placement.py::promote_student` |
| Severity | High |

| Field | TC-PRM-04 |
|---|---|
| Module | Academic history after promotion |
| Objective | Previous-year results stay visible |
| Preconditions | Student with a published Grade 5 result |
| Test Role | Principal, Parent |
| Test Steps | 1. Promote to Grade 6. 2. Read results |
| Expected Result | Grade 5 result still listed |
| Actual Result | Grade 5 result disappears (1 exam → 0) |
| Status | **Fail** |
| Evidence | A (AC-12); C `services/exams.py::student_results` (filters by current `class_name`) |
| Severity | High |

### 6.10 Notifications

| Field | TC-NT-01 |
|---|---|
| Module | Role-wide notification read status |
| Objective | One person reading a shared notice does not mark it read for others |
| Preconditions | Two coordinators; one role-wide notice |
| Test Role | Coordinator |
| Test Steps | 1. Coordinator 1 marks read. 2. Coordinator 2 lists notifications |
| Expected Result | Read for 1 only |
| Actual Result | As expected |
| Status | **Pass** |
| Evidence | T `test_notification_reads.py` (2) |
| Severity | Medium |

| Field | TC-NT-02 |
|---|---|
| Module | Academic notifications to parents |
| Objective | Parent is notified when results are published or a timetable is approved |
| Preconditions | — |
| Test Role | Parent |
| Test Steps | 1. Publish a result. 2. Check the parent's bell |
| Expected Result | Notification received |
| Actual Result | No academic notification is created by exams, timetable, attendance or placement services |
| Status | **Fail** (not implemented) |
| Evidence | C (no notification calls in those services) |
| Severity | Medium |

---

## 7. Defect and risk register

Columns: ID · Module · Description · Steps to reproduce · Expected · Actual · Severity · Impact · Root cause · Resolution status · Retest · Evidence.
"AC-" IDs come from the academic audit (27 Oct 2026). "DEF-N" IDs were found during the 27 Oct 2026 browser checks. A defect is marked **Resolved** only where a retest exists.

### 7.1 Open defects

| ID | Module | Description | Steps to reproduce | Expected | Actual | Severity | Impact | Root cause | Status | Retest | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AC-06 | Marks | Marks cannot be published from the screens | Coordinator → Mark Entry; or look for a Coordinator/Principal marks approval screen | Save, submit and 3-step approval possible | "Entry closed" banner; no Coordinator/Principal approval screen | Critical | No result ever reaches parents/students through the UI | Browser-stored closure rule `CLS-0001` (closed from 2026-09-01); approval screens never built for steps 1–2 | Open | Browser 27 Oct: still failing | B-SS-04, B-SS-05, C |
| AC-08 | Exams | Exam subject schedule lost; Student Exam Schedule shows demo data | Create exam with subject rows; open Student Exam Schedule | Real subjects/dates for own class | Rows not sent; demo EXM-100x rows shown | High | Students/parents see wrong exam dates | Form sends header only; student page reads demo localStorage | Open | Browser 27 Oct: still failing | B-SS-08, C |
| AC-07 | Results / reports | No grading rule; no report card; result page summary hardcoded | Student → Exam Result | Real summary, school grading | "Average 80.25 %" with no results; every row "Pass" | High | Misleading academic information | Placeholder UI; no grading design | Open | Browser 27 Oct: still failing | B-SS-07, C |
| AC-12 | Promotion / history | Earlier results vanish after promotion | Promote a student with results; read results | History kept | Earlier exams no longer listed | High | Loss of visible academic history | Results matched by current class name | Open | Not retested since audit | A, C |
| AC-13 | Data integrity | Class and year are free text in admissions, exams and lesson plans | Create exam for class "5" | Matches "Grade 5" or is refused | Accepted; never matches students | High | Marks/results silently miss students | No foreign key to the class master | Open | — | A, C |
| AC-14 | Marks | Batch does not enforce section, subject master or teacher allocation | Add a 5B student to a 5A batch | Refused | Accepted | Medium | Wrong marks attribution possible | Missing validation | Open | — | A |
| AC-10 | Timetable | Approval is a status field; self-approval possible | Principal creates and approves own timetable | Separate approver and record | Allowed; no record | Medium | Weak control | No approval request created for timetables | Partly resolved: Edit link, Director menu link, student fallback to unapproved fixed 27 Oct | Self-approval: not retested | A, TS, B-SS-02 |
| AC-16 | Placement | Re-placing a placed student allowed; roll gaps | Place the same student twice | Guarded | Allowed (roll 1 → 3) | Medium | Roll numbers inconsistent | No status check | Open | — | A |
| AC-11 | Setup | Academic Years screen unrouted; Subjects screen is a mock-up | Admin menu | Working screens | Missing / static | Medium | Setup only via API | Not built | Open | — | C |
| AC-09 | Allocation / timetable | Save errors swallowed; whole-list saves can overwrite each other | Save allocation with the backend stopped | Error shown | Silent | Medium | Lost changes go unnoticed | `.catch(() => {})` and whole-list PUT | Open | — | C |
| AC-19 | Allocation | Unknown teacher/class/subject accepted | Save "Grade 99"/"Alchemy" | Refused | Accepted | Low | Data quality | No validation | Open | — | A |
| AC-17 | API hygiene | Some GET requests create data (placement options, exam types) | GET placement options for a new class | Read-only | Creates class/sections | Low | Unexpected records | Convenience behaviour | Open | — | A, C |
| AC-18 | Admission | Enrolment accepts emails that sign-in rejects | Enrol with `…@example.test` | Same rule | Account that can never sign in | Medium | Support issue | Different validators | Open | Not retested | A |
| AC-21 | Test coverage | No automated tests for placement and promotion | — | Tests exist | None (only a frontend guard) | Low | Regressions could pass unnoticed | — | Open | — | T search |
| AC-22 | Portal | Parent "Performance Analytics" shows synthetic numbers | Parent → Performance Analytics | Real data or hidden | Synthetic | Low | Misleading | Demo screen | Partly resolved (attendance figures fixed 27 Oct) | Attendance: retested (B-SS-06) | C, B |
| AC-23 | Exams | Director Exam Approvals: rows without an approval change only on screen; "Submitted by" fixed text | — | Real data | As described | Low | Misleading | Demo leftovers | Open | Not retested | C |
| DEF-N01 | Marks | Mark Entry page says marks go "to the Director"; server chain is Coordinator → Principal → Director | Open Mark Entry | Text matches the process | Mismatch | Low | Confusing for staff | Outdated text | Open | — | B-SS-04 |
| DEF-N02 | Lesson plan | Inert "From Beginning" dropdown on the lesson plan list | Open Lesson Plan | Works or removed | Does nothing | Low | Cosmetic | Leftover control | Open | — | B-SS-03 |
| DEF-N03 | Promotion | No guard against a second promotion in the same academic year | Promote the same student twice | Second refused | Code would allow it | High | Students could skip a grade by mistake | Rule is "current grade + 1" with no year check | **Suspected, Pending verification** | Not executed | C |
| DEF-N04 | Notifications | No academic notifications (results, timetable, attendance) to parents/students | Publish a result | Parent notified | Nothing | Medium | Parents must check manually | Not built | Open | — | C |
| DEF-N05 | Timetable | No clash validation when saving timetables | Same teacher, same period, two classes | Warned/refused | Saved; shown "(clash)" in teacher view | Medium | Double-booking | Not built | Open | — | C |
| DEF-N06 | Star ratings | Matrix results do not feed the Principal/Student star-rating lists | Rate in matrix; open lists | Same results | Separate systems | Low | Duplicate effort | Two rating models | Open | — | C |

### 7.2 Resolved defects (with retest evidence)

| ID | Module | Description | Resolution | Retest | Evidence |
|---|---|---|---|---|---|
| AC-01 | Results | Parents/students could read the whole-class result table | Server restricts the class table to staff | Pass | T `test_academic_privacy.py::test_parents_and_students_cannot_read_class_result_table` |
| AC-02 | Attendance | Parents/students could read any class roster | Portal roles refused | Pass | T `::test_portal_roles_cannot_list_class_attendance` |
| AC-03 | Portals | Portals saw draft exams, all timetables, all star ratings | Scoped to own class and approved items | Pass | T `test_academic_access_phase2.py` (portal cases) |
| AC-04 | Results | Teachers could read results of any student | Same rule as student records | Pass | T `::test_assigned_teacher_reads_results_unassigned_is_denied` |
| AC-05 | Lesson plans | UI never submitted plans; Director decisions only in memory | Create now submits; decisions/complete call the server | Code guard pass; **browser save pending** | TS; B-SS-03 |
| AC-20 | Placement | Coordinator placement screen unreachable | Routes and menu restored | Pass | B-DOM (Section Assignment, Promote open) |
| AC-24 | Attendance | No substitute duty | Implemented (migration 0020) | Pass | T `test_academic_phase4.py` |
| AC-25/26/27/28 | Lesson plans, notifications, class content, attendance options | Scope and notification rules | Implemented | Pass | T `test_academic_access_phase3a.py` |
| DEF-R01 | Portals | Placed students/parents saw "Awaiting section assignment" everywhere | Portal profile keeps the placement status | Pass | B-SS-06; TS |
| DEF-R02 | Employee Database | 43 blank rows for Principal/Director | List reads the correct record fields | Pass | B-DOM (names, roles shown) |
| DEF-R03 | Teacher Allocation | Demo teachers (TEA-1001…) offered while loading; Director listed as a teacher | Real HR roster only; Director excluded | Pass | B-DOM; TS |

### 7.3 Risks (not defects)

| Risk | Impact | Mitigation |
|---|---|---|
| Email integration is **live** in the development environment | Real emails could be sent during testing | Automated tests stub all integrations; manual testers should use test addresses |
| Development sign-in page lists demo logins | Exposure if deployed as-is | Switch off before deployment (release checklist) |
| The demo database contains test-style records (e.g. "Test Employee…", demo allocation TEA-1001) | Confusing during client review | Client decision on clean-up (§10) |
| Automated tests write uploaded test files into `backend/uploads` | Disk clutter | Point test uploads to a temporary folder (future change) |
| The dev server briefly ran out of database connections while reloading during code edits | None in steady state (0 pool errors since restart) | Monitor in UAT; not seen outside reloads |

---

## 8. Regression and release checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Production build (`npm run build`) | ✅ Passed | Final run 27 Oct 2026 |
| 2 | Automated backend tests | ✅ 580 passed, 0 failed, 35 skipped | §1.4 |
| 3 | Academic suites (21 files) | ✅ 206 passed | §11.2 |
| 4 | Lint on changed files | ✅ No new errors (77 files) | lint comparison |
| 5 | Critical academic workflow through the screens (admission → result) | ❌ **Blocked** at Mark Entry / marks approval | B-SS-04, B-SS-05 |
| 6 | Browser console checks | ⚠ Partial: no page crashes; four background 403s on non-academic collections (housekeeping, shared inventory, IT tickets) for some roles, harmless | browser sessions 27 Oct |
| 7 | API error checks | ✅ 0 server errors since the current backend process started | backend log review |
| 8 | Database persistence | ✅ Automated (T); live database read-only checks; screen saves **Pending verification** | §5 |
| 9 | Authorization and data isolation | ✅ About 80 access/privacy tests pass; portal pages verified read-only | §6 |
| 10 | Responsive layout | ⬜ **Not tested** | — |
| 11 | Cross-browser | ⬜ **Not tested** (one Chromium-based browser) | — |
| 12 | External integrations | ⬜ **Blocked**: WhatsApp not configured; Razorpay keys empty; biometric device not connected; email live but not exercised | §3 |
| 13 | Migration and backup | ✅ Backup `qmis_erp_before_0021_20261027_211215.dump` checked with `pg_restore --list` (357 entries); migration 0021 applied; single Alembic head; row counts unchanged | `reports/testing-report.md` |
| 14 | Demo logins hidden on sign-in page | ⬜ **Open** (development build shows them) | B |
| 15 | Outstanding release blockers | AC-06, AC-08, AC-07, AC-12, AC-13 | §7.1 |

---

## 9. Readiness classification

| Scope | Classification | Reason |
|---|---|---|
| Admission, enrolment, login policy | **Ready for UAT** | Server tests pass; form verified in the browser; screen save to be confirmed during UAT |
| Placement, grade bands, promotion screen | **Ready for UAT, with known defects** | Works; AC-16, AC-12 and suspected DEF-N03 must be watched |
| Teacher allocation, timetables, lesson plans, attendance | **Ready for UAT, with known defects** | Works on the server and loads in the browser; AC-09, AC-10, DEF-N05 open; lesson plan screen submission pending |
| Examinations → marks → results → report cards | **Blocked** | AC-06 (cannot publish from screens), AC-08, AC-07; report cards not implemented |
| Remedial learning | **Not implemented** | — |
| **Overall academic module** | **Ready for Client Review; Blocked for full Academic UAT** | The end-to-end cycle cannot be completed through the screens |

---

## 10. Open decisions and dependencies

| # | Decision / dependency | Owner | Needed for |
|---|---|---|---|
| 1 | Grading scale, pass marks and result status rules | School | Results, report cards (AC-07) |
| 2 | Report card layout and contents (grades, remarks, attendance, signatures) | School | Report cards |
| 3 | Whether the Mark Entry closure window stays and who can reopen it; or whether it should be removed | School | AC-06 |
| 4 | Marks approval chain: keep Coordinator → Principal → Director (needs two new screens) or shorten it | School | AC-06 |
| 5 | Promotion policy: eligibility (results/attendance), retention, and whether promotion should move students to the **next** academic year | School | Promotion, AC-12, DEF-N03 |
| 6 | Whether timetables need a separate approver (no self-approval) and clash rules | School | AC-10, DEF-N05 |
| 7 | Remedial / improvement workflow requirements | School | Stage 11 |
| 8 | Biometric device model and import method | School / vendor | Biometric integration |
| 9 | Academic notifications to parents (which events, which channels) | School | DEF-N04 |
| 10 | Clean-up of demo/test records in the demo database (e.g. demo allocation TEA-1001, test-style HR employees) | School | Client review clarity |
| 11 | Subject master: build the Subjects screen and agree the subject list | School / developers | AC-11 |

---

## 11. Evidence index

### 11.1 Screenshots

Stored on the test machine in `C:\Users\vikas\AppData\Local\Temp\cursor\screenshots\`, not committed to the repository. They contain only demo names.

| Ref | File | Shows | Test IDs |
|---|---|---|---|
| B-SS-01 | `page-2026-10-27T15-30-34-354Z.png` | Principal → Promote students (form, after unticking) | TC-PRM-01 |
| B-SS-02 | `page-2026-10-27T15-38-12-589Z.png` | Director → Class Timetable Approvals, date filters empty | TC-TT-02, AC-10 |
| B-SS-03 | `page-2026-10-27T16-25-03-725Z.png` | Coordinator → Lesson Plan with "My Submissions / Approved & Delivery" tabs | TC-LP-03 |
| B-SS-04 | `page-2026-10-27T16-25-14-294Z.png` | Coordinator → Mark Entry "Entry closed" banner | TC-MK-02, AC-06 |
| B-SS-05 | `page-2026-10-27T16-25-51-384Z.png` | Director → Mark Entry Approval (0 submissions) | TC-MK-04 |
| B-SS-06 | `page-2026-10-27T16-26-24-928Z.png` | Student → Attendance List, October 2026 | TC-ATT-04, TC-PLC-04 |
| B-SS-07 | `page-2026-10-27T16-26-34-332Z.png` | Student → Exam Result (no results) | TC-RS-03 |
| B-SS-08 | `page-2026-10-27T16-27-02-728Z.png` | Student → Exam Schedule (demo rows) | TC-EX-02 |
| B-SS-09…13 | `page-2026-10-27T13-43-12-980Z.png`, `…13-44-04-538Z.png`, `…13-44-22-716Z.png`, `…13-44-35-729Z.png`, `…13-45-51-535Z.png` | Joint Director pages (crash fix) and Teacher Star of the Month matrix | Non-academic crash fixes; COV-31 |

**B-DOM checks** (page content read, no screenshot) are described in `reports/testing-report.md` ("Browser" section).

### 11.2 Automated test suites (academic-related run, 27 Oct 2026 21:52 IST, 206 passed)

| File | Tests | File | Tests |
|---|---|---|---|
| `test_class_details_api.py` | 7 | `test_academics_collections.py` | 8 |
| `test_admissions.py` | 17 | `test_notification_reads.py` | 2 |
| `test_students.py` | 3 | `test_ops_and_audit_collections.py` | 7 |
| `test_academic_privacy.py` | 26 | `test_frontend_fixes_static.py` | 31 |
| `test_academic_access_phase2.py` | 21 | `test_frontend_student_database_static.py` | 4 |
| `test_academic_access_phase3a.py` | 19 | `test_e2e_campus_flow.py` | 1 |
| `test_academic_phase4.py` | 14 | `test_phase0.py` | 8 |
| `test_attendance_audit.py` | 8 | `test_student_portal_apis.py` | 1 |
| `test_lesson_plans.py` | 7 | `test_leave.py` | 7 |
| `test_exams.py` | 4 | `test_fee_reminders.py` / `test_finance_actions.py` | 3 / 8 |

### 11.3 Other evidence

- Academic audit (API run of 102 checks: 81 pass, 19 fail at the time, several since fixed): `QMIS_ERP_ACADEMIC_MODULE_USER_GUIDE_AND_FLOW_AUDIT.md` §1–§10, with the script and raw results kept outside the repository.
- Daily progress and fixes: `reports/daily-work-report.md` (27 Oct 2026 sections).
- Latest test summary: `reports/testing-report.md`.

---

## 12. Glossary

| Term | Plain-English meaning |
|---|---|
| **API** | The "back door" the screens use to talk to the server. Testing the API checks the rules even if a screen is missing |
| **Backend / server** | The part of the system that stores data and enforces rules |
| **Frontend / screens** | What users see in the browser |
| **Database persistence** | Data is really saved: it is still there after a refresh or a new login |
| **Role-based access control (RBAC)** | Each role (Teacher, Parent, …) can only see and do what its role allows |
| **Data isolation** | One family cannot see another family's data |
| **Regression testing** | Re-running all tests after a change, to make sure nothing that worked before is broken |
| **UAT (User Acceptance Testing)** | The school's own staff try the system with real scenarios before go-live |
| **Migration** | A controlled change to the database structure, applied after a backup |
| **Static guard test** | An automated check that reads program code, to stop a fixed bug from coming back |
| **Approval chain** | The order of people who must approve an item, e.g. Coordinator → Principal → Director |
| **Grade band** | The range of grades a coordinator is responsible for |
| **Placement** | Giving an enrolled student a section and roll number |
| **Stub** | A safe stand-in for an outside service (email, payments) used during testing |

---

## 13. Final acceptance checklist

| # | Item | Status |
|---|---|---|
| 1 | All automated tests pass | ✅ 580 / 0 failed |
| 2 | Production build passes | ✅ |
| 3 | Admission → enrolment verified through the screens with a test family | ⬜ Pending (UAT) |
| 4 | Placement and promotion verified through the screens | ⬜ Pending (UAT) |
| 5 | Lesson plan submit → approval → done through the screens | ⬜ Pending (needs Coordinator/Principal approval screens) |
| 6 | Attendance marking and correction through the screens | ⬜ Pending (UAT) |
| 7 | Exam → marks → approval → published result through the screens | ❌ Blocked (AC-06) |
| 8 | Student/parent views show only own data | ✅ Server tests; read-only browser checks |
| 9 | Report cards available | ❌ Not implemented |
| 10 | Responsive / cross-browser checks | ⬜ Not tested |
| 11 | Integrations (email, WhatsApp, payments, biometric) | ⬜ Blocked / not tested |
| 12 | Demo logins removed from the sign-in page for deployment | ⬜ Open |
| 13 | School decisions in §10 recorded | ⬜ Open |
