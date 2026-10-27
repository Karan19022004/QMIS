# QMIS ERP — Academic Module User Guide and Flow Audit

**Audit date:** 27 Oct 2026  **Type:** audit (sections 0–11), then **Phase 1 privacy fixes** (section 12) and **Phase 2 access-control hardening** (section 13).

> **Phase 1 update (27 Oct 2026):** AC-01, AC-02 and AC-04 are **resolved**, with 26 regression tests (`backend/tests/test_academic_privacy.py`). See [section 12](#12-phase-1--privacy-fixes-27-oct-2026).
>
> **Phase 2 update (27 Oct 2026):**
> - Teacher/coordinator attendance reads and writes are limited to authorized assignments.
> - Coordinators see and approve only marks batches inside their grade band or allocations.
> - Parents and students see only approved exams for their own class, and only their child's timetables and star ratings. **AC-03 resolved.**
> - **Substitute duty is BLOCKED:** no mechanism exists, so no substitute access is granted (AC-24, with a proposed design).
>
> 21 new regression tests (`backend/tests/test_academic_access_phase2.py`). Full backend suite: **479 passed, 34 skipped, 0 failed**. See [section 13](#13-phase-2--academic-access-control-hardening-27-oct-2026).
>
> **Phase 3A update (27 Oct 2026):**
> - Lesson plans follow the coordinator grade-band/allocation rule (AC-25).
> - Scoped approval steps notify only eligible coordinators (AC-26).
> - The six class-content collections are limited to the child's class and section (AC-27).
> - Parents and students see only Approved timetables.
> - The Class Attendance screen lists only the teacher's authorized sections (AC-28).
>
> 19 new tests (`backend/tests/test_academic_access_phase3a.py`). Full backend suite: **498 passed, 34 skipped, 0 failed**; frontend build passed. See [section 14](#14-phase-3a--remaining-academic-access-policies-27-oct-2026).
>
> **Phase 4 update (27 Oct 2026):**
> - A coordinator's own marks batch or lesson plan is routed to the Principal, then the Director.
> - A step with no eligible approver waits and alerts an administrator.
> - Administrator-assigned **substitute duty** is implemented: model, migration `0020`, API, a page for Principal/Director/Admin, and the Class Attendance screen.
>
> 14 new tests (`backend/tests/test_academic_phase4.py`). Full suite **512 passed, 34 skipped, 0 failed**; frontend build passed. **The migration has NOT been applied to the live `qmis_erp` database; that needs your approval (§15.7).** See [section 15](#15-phase-4--approval-edge-cases-and-substitute-duty-27-oct-2026).

## 0. Summary

The academic **backend** works end to end. A test student was taken from admission through placement, an approved exam, marks entry, a three-step marks approval and a published result visible to the parent. The same student UUID and admission number carried through every stage.

The **frontend does not complete the same journey**. Three breaks stop a real user before results exist:

1. **Lesson plans are never submitted.** The UI saves a draft and shows it as "Pending", but never calls `/lesson-plans/{id}/submit`. The Director's Approve button only changes browser memory.
2. **Marks cannot be published from the UI.** The backend requires Coordinator → Principal → Director approval. Only the Director has a marks approval screen, and the backend refuses the Director while the Coordinator step is pending. Mark Entry Save/Submit is also gated by a browser-stored "Mark Entry closed since 1 Sep 2026" rule.
3. **There is no progress report or report card** anywhere: no route, page, API or table.

There were also **privacy gaps**. Parents and students could read the whole-class exam result table (classmates' names, admission numbers, marks, ranks) and the class attendance roster, and teachers could read results of students outside their classes. *These three were fixed in Phase 1 (section 12).*

The live database matches this picture:
- 0 lesson plans
- 1 draft marks batch
- 0 marks approvals ever
- 25 of 27 students still awaiting placement
- 19 of 27 students with no academic year

### Stage verdicts

**Evidence key:** **A** = API-tested on an isolated database, **C** = code inspection, **L** = live database read (read-only), **T** = existing automated tests.

| # | Stage | Backend (API) | UI | Overall |
|---|---|---|---|---|
| 1 | Masters: years, classes, sections, subjects | PASS (A) | Class Details wired (C); Academic Years and Subjects pages **FAIL** (C) | Partial |
| 2 | Admission → enroll | PASS (A, T) with 2 validation **FAIL**s | NOT TESTED in browser | Works, with gaps |
| 3 | Placement | PASS (A) with 2 **FAIL**s | Principal: NOT TESTED; Coordinator **FAIL** (unreachable) (C) | Works for Principal |
| 4 | Teacher allocation | PASS save/read (A); no validation **FAIL** (A) | Silent save errors (C) | Partial |
| 5 | Timetable | PASS save/read (A); approval **FAIL** (A, C) | Pending shown to teachers and students (C) | Partial |
| 6 | Lesson plans | PASS full chain (A, T) | **FAIL**: never submits; approval is memory-only (C, L) | **BLOCKED in UI** |
| 7 | Examinations | PASS header + Director approval (A, T); subject schedule and question papers **FAIL** | Subject rows dropped; student schedule is demo data (C) | Partial |
| 8 | Marks entry | PASS validation + chain (A, T); section/subject checks **FAIL** (A) | **BLOCKED**: closure rule plus missing Coordinator/Principal approval UI (C, A, L) | **BLOCKED in UI** |
| 9 | Results | PASS calculation + own-child scope (A, T); whole-class leak and teacher scope **fixed in Phase 1** (A, T) | Hardcoded "Pass", demo summary and chart (C) | Partial |
| 10 | Progress reports | **FAIL**: not implemented (A route scan, C) | **FAIL**: not implemented (C) | **FAIL** |
| 11 | Parent/Student portals | PASS own-child scope (A); roster leak **fixed in Phase 1**; drafts, timetables and star ratings **fixed in Phase 2** (A, T) | NOT TESTED in browser | Backend PASS |
| 12 | Data integrity | PASS UUID + admission number (A); promotion hides results **FAIL** (A); class/year text links **FAIL** (A, L) | — | Gaps |

---

## 1. How this was verified

| Method | What was done |
|---|---|
| **API (A)** | A throwaway script drove the real FastAPI app (in-process `TestClient`) against a **fresh SQLite file outside the repo**, using the seeded demo logins. SMTP, WhatsApp, Razorpay and ProTrack were blanked; `backend/.env` was not loaded. It ran **102 checks: 81 PASS, 19 FAIL, 2 INFO**. |
| **Existing tests (T)** | 14 academic-related suites (`test_exams`, `test_lesson_plans`, `test_academics_collections`, `test_class_details_*`, `test_admissions`, `test_approvals`, the five portal suites, `test_students`, `test_phase0`): **88 passed, 0 failed**. |
| **Live DB (L)** | `SELECT` queries inside `SET TRANSACTION READ ONLY` on the dev Postgres `qmis_erp`, rolled back. I did not sign in through the live API, because a login writes an audit row. |
| **Code (C)** | Frontend routes, sidebar, data layers and services; backend endpoints, services, models and permission matrix. |
| **Browser (B)** | **Not performed.** A browser walkthrough would write to the live database and to the browser's localStorage, which this audit had to avoid. Every UI item is marked from code inspection and listed in §9 for manual testing. |

Evidence files (outside the repo):
- `C:\Users\vikas\AppData\Local\Temp\qmis_academic_audit\audit_flow.py` — the script
- `...\audit_results.json` — every check with its HTTP evidence
- `...\run3.txt` — full console output of the final run

API test data used fictional names (Aarav/Bhavya/Charan Audit) and `@example.com` logins, only in that throwaway database.

---

## 2. End-to-end workflow and dependencies

```mermaid
flowchart TD
  M[1 Masters<br/>academic_years, school_classes, sections, subjects] --> AD[2 Admission → enroll<br/>admissions → students + parent/student users]
  AD --> PL[3 Placement<br/>students.section_id, roll_number, placement_status=placed]
  M --> PL
  M --> TA[4 Teacher allocation<br/>sections.class_teacher_user_id + academics_records 'teacher-allocations']
  TA --> TT[5 Class timetable<br/>academics_records 'class-timetables']
  TA --> LP[6 Lesson plans<br/>lesson_plans + approval_requests]
  PL --> EX[7 Exam<br/>exams + approval_requests exam_timetable]
  EX -->|must be approved| MK[8 Marks<br/>marks_batches + mark_entries]
  PL --> MK
  MK -->|Coordinator → Principal → Director| RS[9 Results<br/>computed on read, never stored]
  RS --> PR[10 Progress report<br/>NOT IMPLEMENTED]
  RS --> PT[11 Parent / Student portal]
  PL --> PT
  TT --> PT
```

What each stage reads from the one before:

| Stage | Reads from earlier stage | Join key actually used |
|---|---|---|
| Enroll | Current academic year | `academic_years.is_current` → `students.academic_year_id` (left empty if no year is current) |
| Placement | Student's `class_name`; class and sections of the current year | Class **name text** → `parse_grade`; then `section_id` |
| Teacher roster | `sections.class_teacher_user_id`; `teacher-allocations` JSON | User id, or HR employee code / email inside the JSON |
| Lesson plan | Nothing enforced | Free-text class, section, subject |
| Exam | Nothing enforced | Free-text `class_name`, free-text `academic_year` |
| Marks | Approved exam; students whose `class_name` **exactly equals** `exam.class_name` | `students.id` UUID (foreign key) |
| Results | Approved (published) marks batches; exams whose class name matches the student's **current** class name | `class_name` text plus `students.id` |
| Portals | `students.parent_user_id` / `student_user_id` | User UUID |

---

## 3. Role-to-module access matrix

**W** = create/edit, **R** = read, **A1/A2/A3** = approval step 1/2/3, **—** = no access. "API only" means the permission exists but no routed screen offers it. Permissions come from `backend/app/permissions/matrix.py`; screens come from `src/Common/CommonSidebar/Components/sidebarLinks.js` and the role route files.

| Module | Admin | PRM | Principal | Director | Coordinator | Teacher | Parent | Student |
|---|---|---|---|---|---|---|---|---|
| Masters (years/classes/sections/subjects) | W (UI: Class Details only) | R | R | R | R | R | R | R |
| Admissions & enroll | W | W | — | — | — | — | — | — |
| Student database | R | R | R | R | R (roster) | R (roster) | own child | self |
| Placement | W (API only) | — | **W (UI)** | W (API only) | W within grade band (API only; UI route missing) | — | — | — |
| Promotion | W (API only) | — | **W (UI)** | W (API only) | W within band (API only) | — | — | — |
| Coordinator grade bands | W (API only) | — | **W (UI)** | W (API only) | — | — | — | — |
| Teacher allocation | W (API only) | — | **W (UI)** | W (API only) | R | R | — (empty list) *(Phase 2)* | — (empty list) *(Phase 2)* |
| Class timetable | W (API only) | — | **W + self-approve (UI)** | W + approve (UI, no sidebar link) | W (API only) | R (UI) + change request | R, own child's class/section *(Phase 2)* | R, own class/section *(Phase 2)* |
| Lesson plans | R all | — | R all; A2 (API only) | R all; A3 (**UI is memory-only**) | own W; A1 (API only), **grade band + allocations only** *(Phase 3A)* | own W; submit (API only) | — | — |
| Exam (header) | W; submit refused | — | **W + submit (UI)** | **A (UI)**; exam types/weightage (API only) | W + submit (API only) | R | R, approved + own child's class only *(Phase 2)* | R, approved + own class only *(Phase 2)* |
| Marks | create; submit refused | — | create; submit refused; A2 (API only) | **A3 (UI)** | own W + submit (UI); A1 (API only), **grade band + allocations only** *(Phase 2)* | own W + submit (UI) | — | — |
| Results | R | — | R | R | R, grade band + allocations *(Phase 1)* | R, assigned students only *(Phase 1)* | own child only *(Phase 1)* | self only *(Phase 1)* |
| Attendance roster + marking (`GET`/`POST /attendance`) | R/W | — | R/W | R/W | R/W, grade band + allocations *(Phase 2)* | R/W, class-teacher + allocated sections *(Phase 2)*; substitute duty BLOCKED | — *(Phase 1)* | — *(Phase 1)* |
| Attendance calendar (one student) | R | — | R | R | grade band + allocations *(Phase 1)* | assigned students *(Phase 1)* | own child | self |
| Progress report | not implemented | | | | | | | |

⚠ = over-exposure confirmed by the API test (see §8). *(Phase 1)* / *(Phase 2)* = access rule changed in that phase (sections 12 and 13).

---

## 4. Stage-by-stage trace

### Stage 1 — Academic Years, Class Details, Subjects (Admin)

| Item | Detail |
|---|---|
| Menu → page | Admin sidebar **Class Details** → "Class Details List"; **Add** → `/admin/class/add-class-details`. **Academic Years:** component exists but is **not routed** and not in any sidebar. **Subjects:** `/admin/class/subjects` and `/admin/class/add-subjects` are routed but not in the sidebar, and are **static mockups**. |
| Role | Admin (`masters.write`, which only admin, superadmin and managing_director hold) |
| UI steps | Class Details → Add → pick academic year → class name (e.g. "Grade 5") → add sections with capacity, room and class teacher → Save |
| Frontend | `src/Pages/Admin/Class/ClassDetails/*`, `src/services/classDetailsApi.js` (flag `VITE_USE_API_CLASSES`, defaults to the auth flag) |
| API | `GET/POST /api/v1/masters/academic-years`, `POST …/{id}/set-current`; `GET/POST/PATCH/DELETE /api/v1/masters/classes`; `GET/POST/PATCH /api/v1/masters/sections`; `GET /api/v1/masters/class-teacher-options`; `GET/POST /api/v1/masters/subjects` |
| Tables | `academic_years`, `school_classes` (unique campus + year + name), `sections` (`class_teacher_user_id` → `users`), `subjects` |
| Prerequisites | A current academic year. The seed has `2026-27`. |
| Expected result | Class and sections saved; the class teacher is linked to a teacher login |
| Read next by | Enroll (current year), placement (class/sections), teacher roster (class teacher) |
| **Status** | **API: PASS (A).** Year create, end-before-start rejected, Principal blocked (403), class create, duplicate rejected (409), sections A/B with capacity and class teacher, refresh keeps values, subject create and read. **UI:** Class Details wired (C, NOT TESTED). **Academic Years UI: FAIL (C).** **Subjects UI: FAIL (C).** |
| Issues | Subjects are free text everywhere else; the `subjects` table is never referenced (C). Other pages hardcode year lists, e.g. `teacherAllocationData.js:31` (C). |

### Stage 2 — Admission → Enroll → Student record

| Item | Detail |
|---|---|
| Menu → page | Admin or PRM sidebar **Admissions → Admission Enquiry** / **Admission List**; enroll from the Admission List |
| Role | Admin, PRM (`admissions.write`) |
| UI steps | Admission Enquiry → Add → Convert. Admission List → Edit → fill student/parent details and **Account Information** (parent email and password, optional student email and password) → Save → **Enroll** |
| Frontend | `src/Pages/Admin/FrontOffice/AdmissionEnquiry/*`, `…/AdminssionList/*`, `src/services/admissionsApi.js` (`VITE_USE_API_ADMISSIONS`) |
| API | `POST /api/v1/admissions/enquiries`, `…/{id}/convert`, `POST/PATCH /api/v1/admissions/{id}`, `POST /api/v1/admissions/{id}/enroll` |
| Tables | `admission_enquiries`, `admissions`, `students`, `guardians`, `users` (parent/student logins) |
| Prerequisites | Current academic year; parent email not used by another account |
| Expected result | `students` row with `admission_number = admission_code`, class name in standard form (`V` → `Grade 5`), `academic_year_id` = current year, `placement_status = pending`, and the parent login created and linked |
| Read next by | Placement (pending list); portals (`parent_user_id` / `student_user_id`) |
| **Status** | **API: PASS (A, T).** Enroll with parent + student logins; `V` → `Grade 5`; pending; second enroll 409; edits after enroll 409; teacher blocked 403. **FAIL (A):** class `Grade 55` accepted. **FAIL (A):** enroll creates a login for `…@example.test` that can never sign in (login returns 422). |
| Issues | AC-13 (class not validated), AC-18 (login email validation differs between enroll and login). |

### Stage 3 — Placement (class, section, roll number)

| Item | Detail |
|---|---|
| Menu → page | Principal sidebar **Student Allocation** → "Student Allocation Approval" (`/principal/student-allocation-approval`), **Place** (`…/place/:id`), **Promote** (`…/promote`). Grade bands: `/principal/coordinator-grade-bands` (no sidebar link). |
| Role | Principal (UI). The API also allows Coordinator (within grade band), Director, Admin. |
| UI steps | Student Allocation → pending list → Place → choose section → Save |
| Frontend | `src/Pages/Principal/StudentAllocation/PrincipalStudentPlacement.jsx`, reusing `src/Pages/Coordinator/StudentPlacement/*`; `src/services/placementApi.js` |
| API | `GET /api/v1/students/pending-placement`, `GET /api/v1/students/placement-options?className=`, `POST /api/v1/students/{id}/place`, `POST /api/v1/students/{id}/promote`, `GET/PUT /api/v1/students/coordinator-grade-bands` |
| Tables | `students` (`class_id`, `section_id`, `section`, `roll_number`, `placement_status`), `coordinator_grade_bands` |
| Prerequisites | Enrolled student; class with active sections in the current year |
| Expected result | `placement_status = placed`, section set, roll number = highest in section + 1 |
| Read next by | Teacher roster, attendance roster, portal class/section; marks and results (by class name only) |
| **Status** | **API: PASS (A).** Pending list; Coordinator without band 403; A and B → 5A, C → 5B; refresh shows section A, roll 1. **FAIL (A):** re-placing a placed student is allowed and changes roll 1 → 3. **FAIL (A):** `GET placement-options?className=Grade 9` created a class (classes 1 → 2). **Coordinator UI: FAIL (C)**, no `/coordinator/student-placement` route. **No automated tests (T).** |
| Issues | AC-16, AC-17, AC-20, AC-21 |

### Stage 4 — Teacher allocation

| Item | Detail |
|---|---|
| Menu → page | Principal sidebar **Teacher Allocation** (`/principal/academic/teacher-allocation`, `/allocate/:employeeId`, `/view/:id`, `/edit/:id`) |
| Role | Principal (UI). The API also allows Admin and Director. The class teacher itself is set by Admin in Class Details. |
| UI steps | Teacher Allocation → pick teacher → Allocate → class teacher class/section + subject mappings → Save |
| Frontend | `src/Pages/Principal/TeacherAllocation/teacherAllocationData.js` (flag `VITE_USE_API_ACADEMICS`) |
| API | `GET/PUT /api/v1/academics/teacher-allocations` (replaces the whole list) |
| Tables | `academics_records` (collection `teacher-allocations`, untyped JSON); `sections.class_teacher_user_id` |
| Prerequisites | Teacher HR record or login email; classes and sections |
| Expected result | Allocation stored; the teacher's student list widens to the mapped sections |
| Read next by | `GET /students` roster scope only. It is **not** enforced on lesson plans, marks or results. |
| **Status** | **API: PASS (A).** Save and refresh; class-teacher roster 5A includes A and B and excludes C; adding a 5B mapping extends the roster to C; teacher write refused 403. **FAIL (A):** allocation for an unknown teacher, `Grade 99` and subject `Alchemy` accepted. **UI (C):** the save error is swallowed with `.catch(() => {})` at `teacherAllocationData.js:383`. |
| Issues | AC-09, AC-14, AC-19 |

### Stage 5 — Timetable

| Item | Detail |
|---|---|
| Menu → page | Principal **Class Timetable** → "Class Timetable List" / "Create Class Timetable". Director approval at `/director/class-timetable-approvals` (**no sidebar link**). Teacher/Coordinator **Class → Class Timetable** (`/{role}/class/class-routine`). Student/Parent **Class → Timetable** (`/{role}/class/timetable-list`). |
| Role | Principal creates and approves; Director approves; others read |
| UI steps | Principal → Class Timetable → Create → year, class, section → add periods (day, subject, teacher, time) → Save (status Pending) → Approve in the list |
| Frontend | `src/Pages/Principal/ClassTimetable/*`, `classTimetableData.js` |
| API | `GET/PUT /api/v1/academics/class-timetables`, `GET/PUT /api/v1/academics/class-timetable-change-requests` |
| Tables | `academics_records` (untyped JSON). The `timetable` approval workflow exists in `approvals.py:32` but is **not linked** to these records. |
| Expected result | Timetable visible to the class's teachers, students and parents once approved |
| **Status** | **API: PASS save and read (A).** Teacher write 403 (A); teacher change request saved (A). **Approval FAIL (A, C):** approval is just an `approvalStatus` field, the Principal self-approved their own timetable, and no approval record is created. **UI (C):** save errors swallowed (`classTimetableData.js:429`); the teacher view includes Pending (`teacherAssignedClasses.js:358`); the student view falls back to Pending or Denied when nothing is approved (`TimeTableDetails.jsx:20-24`); the Edit link goes to the unrouted `/principal/edit-class-timetable/:id`. |
| Issues | AC-03, AC-09, AC-10 |

### Stage 6 — Lesson plans

| Item | Detail |
|---|---|
| Menu → page | Teacher/Coordinator **Class → Lesson Plan** (`/{role}/lesson-plan/my-lesson-plan`) and **Lesson Plan Approval** (`/{role}/lesson-plan-approval`, `…/add`). This is the submitter's own list, not an approver screen. Director **Lesson Plan Approval** (`/director/lesson-plan-approval`). No Coordinator or Principal approver screen. |
| Role | Teacher and Coordinator create; Coordinator → Principal → Director approve |
| UI steps | Lesson Plan Approval → Add → class, section, subject, month, chapter, planning rows → Submit |
| Frontend | `src/Common/LessonPlanApproval/*`, `src/services/lessonPlansApi.js`. **Only create and list exist**; no submit, patch, complete or revise calls. |
| API | `POST /api/v1/lesson-plans`, `GET /api/v1/lesson-plans?mine=`, `POST /api/v1/lesson-plans/{id}/submit`, `POST /api/v1/approvals/{approvalId}/decide`, `PATCH`, `/complete`, `/revise` |
| Tables | `lesson_plans` (status is derived from `approval_id`), `approval_requests`, `approval_events` |
| Expected result | After submit, the plan is approved in order Coordinator → Principal → Director, then locked |
| **Status** | **API: PASS (A, T).** Create gives `draft`; submit gives awaiting Coordinator; Director and Teacher deciding early both get 403; Coordinator → Principal → Director each 200; final `approved`; edit after approval 409. **UI: FAIL (C).** The form only POSTs, so plans stay `draft`, which `mapLessonPlanFromApi` displays as "Pending". The Director's Approve/Reject (`updateLessonPlanStatus`) only writes the in-memory cache. **Live (L): 0 lesson plans.** **FAIL (A):** a plan for `Grade 99` / `Alchemy` was accepted. |
| Issues | AC-05, AC-13 |

### Stage 7 — Examinations (setup, schedule, subjects, question papers)

| Item | Detail |
|---|---|
| Menu → page | Principal **Examination Timetable** → Create (`/principal/create-examination-timetable`). Director **Timetable Approvals → Exam Timetable** (`/director/examination-approvals`). Teacher/Coordinator **Student → Exam** (read-only, `/{role}/student-evaluation/exam`), **CA / RCT**, **Question Bank**. Student/Parent **Exam Schedule**. |
| Role | Principal (or Coordinator, API only) creates and submits; Director approves |
| UI steps | Principal → Examination Timetable → Create → name, class, dates, day-wise subject rows → Save. Director → Exam Timetable → Approve |
| Frontend | `src/Pages/Principal/ExaminationTimetable/CreateExaminationTimetable.jsx` sends only name, class and dates; `examType` is hardcoded `'MIDTERM'` (line 74); the subject rows are **not sent**. Director: `ExamApprovals.jsx`. |
| API | `POST /api/v1/exams`, `POST /api/v1/exams/{id}/submit`, `POST /api/v1/approvals/{id}/decide`, `GET /api/v1/exams`, `GET/POST /api/v1/exam-types`, `GET/PUT /api/v1/exam-weightage` |
| Tables | `exams` (`class_name` and `academic_year` are text), `exam_types`, `exam_weightages`, `approval_requests` |
| Prerequisites | A class name that **exactly** matches students' `class_name` |
| Expected result | Exam approved by the Director; marks entry unlocked |
| **Status** | **API: PASS (A, T).** Create; marks blocked on an unapproved exam (409); submit gives awaiting Director; Coordinator deciding 403; Director approves; refresh shows approved. **FAIL (A):** the exam has no per-subject schedule or question-paper fields. **FAIL (A):** class `5` accepted, which will never match `Grade 5` students. **UI (C):** the Student/Parent Exam Schedule reads demo localStorage (`createExamScheduleData.js`), not `/exams`. "Question Bank" is the untyped `sample-questions` collection, with no question-paper approval. |
| Issues | AC-08, AC-13, AC-15 |

### Stage 8 — Marks entry

| Item | Detail |
|---|---|
| Menu → page | Teacher/Coordinator **Student → Mark Entry** (`/{role}/student-evaluation/mark-entry`). Director **Mark Entry Approval** (`/director/mark-entry-approval`, `/review/:contextKey`). |
| Role | Teacher/Coordinator enter; Coordinator → Principal → Director approve (`approvals.py:30`) |
| UI steps | Mark Entry → exam, class, section, subject → enter marks/absent → Save Draft → Submit. Director → Mark Entry Approval → Review → Approve |
| Frontend | `src/Common/MarkEntryApproval/MarkEntryPage.jsx`, `markEntryApprovalData.js`, `src/services/examsApi.js` |
| API | `POST /api/v1/marks-batches`, `GET /api/v1/marks-batches[/{id}]`, `PUT /api/v1/marks-batches/{id}/entries`, `POST …/submit`, `POST …/revise`, `POST /api/v1/approvals/{id}/decide` |
| Tables | `marks_batches`, `mark_entries` (`student_id` → `students.id`) |
| Prerequisites | Approved exam; placed students whose `class_name` equals the exam's |
| Expected result | Batch published after three approvals; results become visible |
| **Status** | **API: PASS (A, T).** 101/100 rejected; draft saved; refresh 88/72; edit 90; non-owner edit 403; submit; locked 409; Coordinator → Principal → Director give `published`. **FAIL (A):** a 5B student was accepted in a 5A batch. **FAIL (A):** subject `Alchemy` accepted, and a subject the teacher is not allocated was accepted. **UI: BLOCKED (C).** Save/Submit return silently while `CLS-0001` ("Mark Entry", Closed from 2026-09-01, `governance.js:8`) applies, and **no Coordinator or Principal screen can approve the batch**. The Director's decide would get "Awaiting 'coordinator' approval" (the same 403 was observed via the API for lesson plans, which use the same chain). **Live (L):** 1 marks batch, still draft; 0 marks approvals ever. |
| Issues | AC-06, AC-14 |

### Stage 9 — Results

| Item | Detail |
|---|---|
| Menu → page | Student/Parent **Student Evaluation → Exam Result** (`/{role}/student-evaluation/exam-result`). No staff results, calculation, approval or publish screen; publishing **is** the third marks approval. |
| Role | Read: parent (own child), student (self), staff |
| Frontend | `src/Pages/Student/Results/ResultDetails.jsx`, `src/services/resultsApi.js` |
| API | `GET /api/v1/results/students/{id}`, `GET /api/v1/exams/{id}/results` |
| Tables | None. Results are computed on every request from published `marks_batches` + `mark_entries`. |
| Calculation (C, A) | Absent subjects excluded; percentage = total ÷ max × 100 (2 decimals); competition rank across the whole class (all sections); per-subject class high; optional weighted final from `exam_weightages`. **No letter grade or pass/fail rule.** |
| **Status** | **API: PASS (A, T).** Nothing before publish; after publish Parent A sees 90/100, 90 %, rank 1; Parent A → child B 404; Student A self 200 / B 404. **FAIL (A):** Parent A and Student A get the **whole-class table** from `GET /exams/{id}/results` (200). **FAIL (A):** a teacher outside the roster gets 403 on the student record but 200 on their results. **FAIL (A):** no grade field. **UI (C):** every API row is shown as `status: 'Pass'` (`ResultDetails.jsx:70`); summary cards come from localStorage; the pie chart is the hardcoded `performanceCategories`. |
| Issues | AC-01, AC-04, AC-07 |
| **Phase 1** | AC-01 and AC-04 **resolved**. Parents and students now get 403 on the class table. Teachers and coordinators get only the rows of students they may open (class-wide rank and class high kept). Per-student results now follow the student-record rule. Re-run of the audit script: Parent A 403, Student A 403, teacher `GET /results/students/C` 403. AC-07 is unchanged. |

### Stage 10 — Progress reports / report cards

**FAIL — not implemented.** The API route scan found no route containing `report-card`, `progress`, `reportcard` or `marksheet`, and code search found no frontend page or service. The nearest data source is `GET /api/v1/results/students/{id}`.

Field source if it were built from existing data:
- Student name, admission number, class → `students`
- Exam name and type → `exams` / `exam_types`
- Subject marks → `mark_entries` via published `marks_batches`
- Percentage, rank, class high → computed in `services/exams.py::_exam_table`
- Attendance → `student_attendance`
- Grade, remarks, teacher sign-off → **no source exists**

### Stage 11 — Parent and Student portals

| Item | Detail |
|---|---|
| Menu → page | Parent/Student sidebar: **Class → Timetable**, **Attendance List**; **Student Evaluation → Exam Result**, **Exam Schedule**; Parent also **Performance Analytics** (synthetic numbers, `DemoScreens.jsx`) |
| API | `GET /api/v1/parents/me/children`, `GET /api/v1/students/me`, `GET /api/v1/results/students/{id}`, `GET /api/v1/attendance/students/{id}/calendar`, `GET /api/v1/academics/{collection}` |
| **Status** | **PASS (A):** first login forced to change password (`/students/me` 403 before change); Parent A sees only child A; `/students/me` returns self; parent blocked from the student list, child B, B's attendance calendar and lesson plans; parent cannot write timetables or marks. **FAIL (A):** `GET /attendance?className=Grade 5&roster=true` returns the whole class (names, admission numbers, sections, roll numbers) to Parent A. **FAIL (A):** the parent exam list includes `draft` exams. **FAIL (A):** the parent timetable read returns other classes (Grade 8). The whole-class result table is covered in stage 9. **UI: NOT TESTED** in browser. |
| Issues | AC-01, AC-02, AC-03 |
| **Phase 1** | AC-02 **resolved**: `GET /attendance` (list and roster, any `className`/`section` spelling) returns 403 for parents and students. The attendance calendar now also applies the teacher/coordinator student-record rule. AC-03 (drafts and timetables) is unchanged. |

### Stage 12 — Academic data integrity (same student through all stages)

| Check | Result |
|---|---|
| Student UUID in admission (`enrolled_student_id`), student, parent's children list, mark entry, results | **PASS (A)**, all `d4f1d712-…` |
| Admission number in admission, student and child record | **PASS (A)**, all `ADM-0001` |
| Class link exam ↔ student | **FAIL (A)**: exact text match; `5` ≠ `Grade 5` |
| Academic year link | **FAIL (A, L)**: exams store free text; live exam `"2026 - 2027"` vs master `"2026-27"`; live timetable `"2025-2026"`; 19 of 27 live students have no `academic_year_id`; results ignore the year |
| History after promotion | **FAIL (A)**: Principal promoted A to Grade 6 (allowed with no result check), and A's Grade 5 result then disappeared (1 exam → 0), because results look up exams by the student's **current** class name |

---

## 5. Step-by-step user guide by role

Steps marked ⛔ do not complete in the current UI; the backend alternative is noted. Sign-in for all roles: `/` → choose a demo login → **Login**. Portal accounts must change their password on first login.

### Admin (`admin@qmis.edu`)
1. **Academic year:** there is no screen (⛔). The seed provides `2026-27` as current. Changing it needs `POST /api/v1/masters/academic-years` + `/set-current`.
2. **Class Details** → **Add** → pick year → class name in the form **`Grade N`** (other screens match this exact text) → add sections with capacity, room number and **class teacher** → Save. Re-open the list to confirm.
3. **Subjects:** ⛔ the screen is a mockup. Subjects are typed as free text in later screens.
4. **Admissions → Admission Enquiry** → Add → Save → **Convert**.
5. **Admissions → Admission List** → Edit the converted record → fill details. Under **Account Information** enter a parent email (real domain, not already a staff login) and password, plus an optional student email and password → Save → **Enroll**.
6. **User Database → Student Database** → confirm the student shows the class and "awaiting placement".

### PRM (`prm@qmis.edu`)
Same as Admin steps 4–6, from the PRM sidebar (**Admission Enquiry**, **Admission List**, **User Database → Student Database**).

### Principal (`principal@qmis.edu`)
1. **Student Allocation** → pending list → **Place** → choose section → Save. Check that the roll number appears. Use **Promote** at year end (note AC-12).
2. **Coordinator grade bands:** open `/principal/coordinator-grade-bands` directly (no menu link) and set each coordinator's grade range.
3. **Teacher Allocation** → pick a teacher → **Allocate** → class-teacher class/section and subject mappings → Save. Re-open to confirm; save errors are not shown (AC-09).
4. **Class Timetable** → **Create** → year/class/section → periods → Save (Pending) → **Approve** in the list. ⛔ this is a self-approval with no Director step.
5. **Examination Timetable** → **Create** → name, class (`Grade N`), dates → Save. This creates the exam and submits it to the Director. Subject rows are not saved (AC-08).
6. ⛔ **Lesson plan / marks approval (step 2):** no Principal screen exists.

### Coordinator (`coordinator@qmis.edu`)
1. **Class → Lesson Plan Approval → Add** → fill plan → Submit. ⛔ it stays a draft (AC-05).
2. **Student → Mark Entry** → exam/class/section/subject → marks → Save Draft → Submit. ⛔ blocked by the closure rule (AC-06).
3. ⛔ **Approval step 1 (lesson plans, marks):** no Coordinator approval screen exists.
4. ⛔ **Placement:** no routed screen.

### Teacher (`teacher@qmis.edu`)
1. **Class → Class Timetable** — weekly view, including Pending timetables.
2. **Student → Students List** — shows only the class-teacher section and allocated sections.
3. **Class → Lesson Plan Approval → Add** → Submit. ⛔ stays draft.
4. **Student → Exam** — read-only list of exams.
5. **Student → Mark Entry** → choose the approved exam, class, section and subject → marks (0..max, or Absent) → **Save Draft** → **Submit**. ⛔ closure rule; ⛔ approval chain.

### Director (`director@qmis.edu`)
1. **Timetable Approvals → Exam Timetable** → Approve or Deny (decision saved through `/approvals/{id}/decide`).
2. **Lesson Plan Approval** → group → Approve. ⛔ browser memory only.
3. **Mark Entry Approval** → Review → Approve. ⛔ backend returns "Awaiting 'coordinator' approval" until Coordinator and Principal approve, and they have no screen.
4. Class timetable approval: open `/director/class-timetable-approvals` directly (no menu link).

### Parent (`parent@qmis.edu` or the enrolled parent)
1. First login → set a new password.
2. **Class → Timetable** (approved timetable for the child's class; falls back to unapproved), **Attendance List** (calendar from the API).
3. **Student Evaluation → Exam Result** — published marks only; status always shows "Pass" (AC-07). **Exam Schedule** shows demo data (AC-08).

### Student (`student@qmis.edu` or the enrolled student)
Same as Parent, scoped to self (`GET /students/me`).

---

## 6. Routes, APIs and entities reference

| Stage | Frontend route(s) | Backend API | Table(s) |
|---|---|---|---|
| Masters | `/admin/class/class-details`, `/admin/class/add-class-details` (Academic Years unrouted; Subjects routed but mockup) | `/api/v1/masters/academic-years`, `/classes`, `/sections`, `/subjects`, `/class-teacher-options` | `academic_years`, `school_classes`, `sections`, `subjects` |
| Admission | `/admin/front-office/admission-enquiry`, `/admin/front-office/admission-list`, `/front-office/*` | `/api/v1/admissions/enquiries[/{id}][/convert]`, `/api/v1/admissions[/{id}][/enroll]` | `admission_enquiries`, `admissions`, `students`, `guardians`, `users` |
| Student DB | `/{admin,principal,director}/user-management/student-database`, `/{teacher,coordinator}/user-management/students-list` | `/api/v1/students[/{id}]`, `/api/v1/students/me` | `students` |
| Placement | `/principal/student-allocation-approval[/place/:id \| /promote]`, `/principal/coordinator-grade-bands` | `/api/v1/students/pending-placement`, `/placement-options`, `/{id}/place`, `/{id}/promote`, `/coordinator-grade-bands`, `/placed`, `/my-grade-band` | `students`, `coordinator_grade_bands` |
| Allocation | `/principal/academic/teacher-allocation[/…]` | `/api/v1/academics/teacher-allocations` | `academics_records` |
| Timetable | `/principal/class-timetable`, `/principal/create-class-timetable`, `/director/class-timetable-approvals`, `/{teacher,coordinator}/class/class-routine`, `/{student,parent}/class/timetable-list` | `/api/v1/academics/class-timetables`, `/class-timetable-change-requests` | `academics_records` |
| Lesson plans | `/{teacher,coordinator}/lesson-plan/my-lesson-plan`, `/{teacher,coordinator}/lesson-plan-approval[/add]`, `/director/lesson-plan-approval` | `/api/v1/lesson-plans[/{id}][/submit\|/complete\|/revise]`, `/api/v1/approvals/{id}/decide` | `lesson_plans`, `approval_requests`, `approval_events` |
| Exams | `/principal/examination-timetable`, `/principal/create-examination-timetable`, `/director/examination-approvals`, `/{teacher,coordinator}/student-evaluation/exam`, `/{student,parent}/student-evaluation/exam-schedule` | `/api/v1/exams[/{id}][/submit]`, `/api/v1/exam-types`, `/api/v1/exam-weightage` | `exams`, `exam_types`, `exam_weightages` |
| Marks | `/{teacher,coordinator}/student-evaluation/mark-entry`, `/director/mark-entry-approval[/review/:contextKey]` | `/api/v1/marks-batches[/{id}][/entries\|/submit\|/revise]` | `marks_batches`, `mark_entries` |
| Results | `/{student,parent}/student-evaluation/exam-result` | `/api/v1/results/students/{id}`, `/api/v1/exams/{id}/results` | (computed) |
| Portals | `/{student,parent}/class/attendance-list` and the above | `/api/v1/parents/me/children`, `/api/v1/attendance/students/{id}/calendar` | `students`, `student_attendance` |

---

## 7. Verification checklist

Result codes are the same as §0: **A** = API, **C** = code, **L** = live read, **T** = automated tests. Unchecked boxes failed or were not tested.

**1 Masters**
- [x] Current year exists; create year; invalid dates rejected; Principal blocked (A)
- [x] Create class; duplicate 409; sections with capacity and class teacher; refresh keeps values (A)
- [x] Subject create and read via API (A)
- [ ] Academic Years screen reachable (C: FAIL)
- [ ] Subjects screen functional (C: FAIL)
- [ ] Class Details save → refresh in browser (NOT TESTED)

**2 Admission**
- [x] Enroll creates student + parent + student logins; `V` → `Grade 5`; pending; current year (A)
- [x] Second enroll 409; edit after enroll 409; teacher 403 (A)
- [ ] Class validated against masters (A: FAIL)
- [ ] Enroll and login accept the same email formats (A: FAIL)
- [ ] Browser enroll → Student Database (NOT TESTED)

**3 Placement**
- [x] Pending list; Principal places; roll number assigned; Coordinator outside band 403 (A)
- [ ] Re-placing guarded (A: FAIL)
- [ ] Options GET is read-only (A: FAIL)
- [ ] Coordinator placement UI (C: FAIL)
- [ ] Automated tests exist (T: none)

**4 Teacher allocation**
- [x] Save/read; roster follows class teacher + mappings; teacher write 403 (A)
- [ ] Allocation contents validated (A: FAIL)
- [ ] Allocation enforced on marks/lesson plans/results (A: FAIL)
- [ ] UI shows save errors (C: FAIL)

**5 Timetable**
- [x] Save/read; teacher write 403; change request (A)
- [ ] Separate approval record and no self-approval (A: FAIL)
- [ ] Students see only approved, own-class timetables (A, C: FAIL)
- [ ] Edit link works (C: FAIL)

**6 Lesson plans**
- [x] Create → submit → Coordinator → Principal → Director; order enforced; lock (A, T)
- [ ] UI submits (C: FAIL)
- [ ] UI approvals persist (C: FAIL)
- [ ] Coordinator/Principal approval screens (C: FAIL)
- [ ] Class/subject validated (A: FAIL)

**7 Exams**
- [x] Create, submit, Director approve; Coordinator 403; marks blocked until approved (A, T)
- [ ] Subject-wise schedule / question papers (A, C: FAIL)
- [ ] Class/year validated (A, L: FAIL)
- [ ] Student/Parent schedule from API (C: FAIL)

**8 Marks**
- [x] Max-marks, owner, lock, draft save/refresh/edit, three-step publish (A, T)
- [ ] Section enforced (A: FAIL)
- [ ] Subject/allocation enforced (A: FAIL)
- [ ] UI Save/Submit work today (C: BLOCKED, confirm in browser)
- [ ] UI can complete approval (C: BLOCKED)

**9 Results**
- [x] Percentage/rank; hidden until published; own-child/self only on `/results/students/{id}` (A, T)
- [x] Class table restricted to staff (Phase 1: A, T)
- [x] Teacher scoped (Phase 1: A, T)
- [ ] Grade/pass rule (A: FAIL)
- [ ] UI shows real status and summary (C: FAIL)

**10 Progress report**
- [ ] Exists (A, C: FAIL)

**11 Portals**
- [x] Forced password change; children scoped; self scoped; cross-family 403/404; no writes (A)
- [x] Attendance roster closed to parents/students (Phase 1: A, T)
- [x] Exams and timetables scoped (Phase 2: A, T)
- [ ] Browser walkthrough (NOT TESTED)

**12 Integrity**
- [x] UUID and admission number consistent (A)
- [ ] History kept after promotion (A: FAIL)
- [ ] ID-based class/year links (A, L: FAIL)

---

## 8. Issues discovered

Severity: **High** = blocks the workflow or exposes other families' data; **Medium** = wrong or unsafe data, or a misleading UI; **Low** = hygiene or coverage.

| ID | Sev. | Stage | Issue | Evidence |
|---|---|---|---|---|
| AC-01 | High → **RESOLVED (Phase 1)** | 9/11 | Parent and student can read the **whole-class result table** (names, admission numbers, per-subject marks, ranks) via `GET /api/v1/exams/{id}/results`. It only checks the campus. | A: Parent A 200, Student A 200; C: `services/exams.py:622-636`, `_load_exam` |
| AC-02 | High → **RESOLVED (Phase 1)** | 11 | Parent and student can read **any class's attendance roster** via `GET /api/v1/attendance?className=&roster=true` (names, admission numbers, sections, roll numbers). | A: Parent A 200 with Charan (5B) listed; C: `endpoints/attendance.py:16-35` |
| AC-03 | Medium → **RESOLVED (Phase 2)** | 5/11 | Portal reads of `/api/v1/academics/{collection}` return the whole campus (all timetables, allocations, star ratings). The `/exams` list includes drafts. | A: classes `['Grade 8','Grade 5']`, statuses `['approved','draft']`; C: `academics_collections.py` |
| AC-04 | Medium → **RESOLVED (Phase 1)** | 9 | A teacher can read results of any student, including ones they cannot open. | A: `GET /students/C` 403 vs `GET /results/students/C` 200; C: `exams.py:662` |
| AC-05 | High | 6 | Lesson-plan UI never submits, so plans stay draft but display as "Pending". Director approve/reject is memory-only. No Coordinator/Principal approver screen. | C: `lessonPlansApi.js` (create/list only), `lessonPlanApprovalData.js:71-77, 205-216`; A: Director list shows `status=draft, approvalId=None`; L: 0 lesson plans |
| AC-06 | High | 8 | Marks cannot be published from the UI. (a) Save/Submit return silently while the localStorage closure rule `CLS-0001` (Mark Entry, Closed from 2026-09-01) applies. (b) The chain is Coordinator → Principal → Director, but only the Director has a marks approval screen, and the Director is refused until the Coordinator decides. | C: `governance.js:8,41-48`, `MarkEntryPage.jsx:301,353`, `approvals.py:30`, sidebar has no Coordinator/Principal approval entry; A: "Awaiting 'coordinator' approval" 403; L: 1 draft batch, 0 marks approvals |
| AC-07 | High | 9/10 | No grading rule; UI marks every result "Pass"; summary cards from localStorage; chart hardcoded; **no progress report or report card**. | A: result keys have no grade; route scan empty; C: `ResultDetails.jsx:12-19,55-74` |
| AC-08 | High | 7 | Exam schedule detail is lost: the Principal form drops day/subject rows and hardcodes `MIDTERM`; there is no exam-subject table or question-paper flow; the Student/Parent Exam Schedule shows demo localStorage data. | C: `CreateExaminationTimetable.jsx:72-80`, `Student/StudentEvaluation/ExamSchedule.jsx:7,13`; A: exam keys have no subjects |
| AC-09 | Medium | 4/5 | Timetable and allocation saves are fire-and-forget (`.catch(() => {})`) and replace the whole collection, so a failed save looks successful and concurrent saves overwrite each other. | C: `classTimetableData.js:429,434`, `teacherAllocationData.js:383`, `academics_collections.py:102-145` |
| AC-10 | Medium | 5 | Timetable approval is a JSON field: the Principal self-approves; the Director page has no menu link; teachers see Pending; students fall back to Pending/Denied; the Edit link goes to an unrouted path. | A: Principal self-approve 200, no approval record; C: `ClassTimetableList.jsx:86,293`, `TimeTableDetails.jsx:20-24`, `teacherAssignedClasses.js:358` |
| AC-11 | Medium | 1 | Academic Years page unrouted; Subjects pages are static mockups with no menu entry; the `subjects` master is never referenced; year and subject dropdowns are hardcoded. | C: no import of `AcademicYears`; `Pages/Admin/Subjects/*`; `teacherAllocationData.js:31,37-44` |
| AC-12 | High | 12 | Promotion hides a student's earlier results. Results look up exams by the **current** class name. Promotion also does not consider results. | A: promote 200; Grade 5 exams 1 → 0; C: `exams.py:666`, `placement.py:290-364` |
| AC-13 | High | 2/6/7 | Class is free text everywhere: admission `Grade 55`, exam `5` and lesson plan `Grade 99` were all accepted. Marks/results match by exact string, so an exam typed `5` never matches `Grade 5` students. | A: all 201; C: `class_dependencies.py:1-27`, `exams.py:591` |
| AC-14 | Medium | 8 | Marks batch does not enforce section, subject master or teacher allocation (a 5B student accepted in a 5A batch; `Alchemy` accepted; unallocated subject accepted). | A: both 201; C: `exams.py:415-457` |
| AC-15 | Medium | 7/12 | Academic year is unreliable: exams store free text; live exam `"2026 - 2027"` vs master `"2026-27"`; live timetable `"2025-2026"`; 19 of 27 live students have no year; results/lesson plans/batches have no year. | L: queries in §10; C: `models/exams.py` |
| AC-16 | Medium | 3 | Re-placing an already placed student is allowed and assigns a new roll number (1 → 3), leaving gaps. The roll uniqueness index exists only in the Alembic migration. | A; C: `placement.py:228-286`, `alembic 0017:80-99` |
| AC-17 | Low | 3/7 | Some GET endpoints write data: `GET /students/placement-options` creates classes and sections; `GET /exam-types` seeds defaults. | A: classes 1 → 2; C: `placement.py:560-639`, `exams.py:79-116` |
| AC-18 | Medium | 2 | Enroll accepts parent/student emails that the login endpoint rejects (reserved domains such as `example.test`), creating a login that can never sign in. | A: enroll 200 `parent_created=True`, login 422 |
| AC-19 | Low | 4 | Teacher allocation accepts unknown teachers, classes and subjects. | A: 200 |
| AC-20 | Low | 3 | Coordinators have grade bands (3 live rows) but no routed placement screen; `/coordinator/student-allocation` redirects to the dashboard. | C: `CoordinatorRoutes.jsx:102-103`; L |
| AC-21 | Low | all | No automated tests for placement, promotion or grade bands, or for portal denial on `/exams/{id}/results`, `/attendance` and `/academics/*`. | T: search found no test calling these paths |
| AC-22 | Low | 11 | Parent "Performance Analytics" shows synthetic numbers generated from the student id. Attendance subject-wise blocks are hardcoded. | C: `DemoScreens.jsx:116`, `AttendanceDetails.jsx:20,28` |
| AC-23 | Low | 7 | Director Exam Approvals: rows without an `approvalId` change only on screen; "Submitted by" is the hardcoded constant `'Principal'`. | C: `ExamApprovals.jsx:116-122,150-156` |
| AC-24 | Medium → **IMPLEMENTED (Phase 4), live migration awaiting approval** | 8/11 | **No substitute-duty mechanism exists**, so substitute attendance marking cannot be authorized. After Phase 2, a teacher covering another class cannot mark it. | C: `API_BACKLOG.md:94` ("Deferred …: Academics substitution"); `daily-work-report.md:1391` ("emergency substitution not built"); no model, endpoint or collection. Proposal in §13.4. |
| AC-25 | Medium → **RESOLVED (Phase 3A)** | 6 | Coordinators still see and approve **lesson-plan** approvals campus-wide (Policy 2 covered marks batches only). | C: `approvals._entity_visible` handles `marks_batch` only |
| AC-26 | Low → **RESOLVED (Phase 3A)** for marks batches and lesson plans | 8 | Approval notifications go to **every** user of the next role (`role_code` broadcast), including out-of-band coordinators. Titles contain exam/subject/class, but no student data. | C: `approvals._notify` |
| AC-27 | Low → **RESOLVED (Phase 3A)** | 11 | Portal reads of class content (`home-fun`, `study-materials`, `sample-questions`, `unit-tests`, `extra-classes`, `online-classes`) still return the whole campus. These contain no student data, and their items have no agreed class field. | C: `academics_collections._portal_items` |
| AC-28 | Low → **RESOLVED (Phase 3A)** | 8 | Teacher Class Attendance screen still lists every class (hardcoded `CLASSES`). After Phase 2, choosing an unassigned class shows the 403 message. | C: `Pages/Teacher/Attendance/ClassAttendance.jsx:8-15` |

---

## 9. Items requiring manual (browser) testing

Use a non-production database or accept that these will create records:

1. **Mark Entry closure rule (AC-06a):** as Teacher, open Mark Entry, enter marks, click Save Draft. Confirm whether anything saves or any message appears. Then raise and approve a re-entry request (Super Admin → Re-entry Approvals) and retry.
2. **Marks approval from the Director screen (AC-06b):** after a successful submit, Director → Mark Entry Approval → Approve. Confirm the error shown.
3. **Lesson plan (AC-05):** Teacher adds a plan; Director approves; refresh the page. Confirm the status reverts to Pending.
4. **Class Details:** create class + sections + class teacher; refresh; confirm values.
5. **Admission → Enroll → Student Database:** full UI path with a fresh parent email; then parent first login and password change.
6. **Principal placement and promotion:** place, refresh, check roll number; promote; open the parent Exam Result.
7. **Teacher Allocation:** save, then stop the backend and save again. Confirm no error is shown (AC-09).
8. **Class timetable:** create, approve; check the Teacher Class Timetable and the Student/Parent Timetable, including before approval; click Edit (AC-10).
9. **Examination timetable:** create with day-wise subject rows; Director approve; check that the rows are missing in the Teacher "Exam" list and the Student "Exam Schedule" (AC-08).
10. **Parent/Student Exam Result:** check "Pass" for a low score, summary cards and chart (AC-07).
11. **Portal privacy in DevTools:** signed in as a parent, call `/api/v1/exams/{id}/results` and `/api/v1/attendance?date=…&className=…&roster=true` (AC-01/02). After Phase 1 both should return 403 with no student data. Also confirm the Parent/Student Attendance List and Exam Result pages still load for the parent's own child.
12. **Academic Years / Subjects screens:** confirm they are unreachable or non-functional from the menu (AC-11).
13. **Phase 2 screens:**
    - As Teacher, open Class Attendance for the class-teacher section (loads and saves) and for another class (403 message shown).
    - As Parent/Student, open Timetable, Star Ratings and Exam Result. They should show only the child's own data, and the Timetable page must still load even though change requests come back empty.
    - As Director, open Mark Entry Approval.

---

## 10. Live database snapshot (read-only, 27 Oct 2026)

| Item | Value |
|---|---|
| Academic years | `2026-27` (current) |
| Classes / sections / sections with class teacher | 14 / 40 / 1 |
| Subjects | 1 |
| Students placed / pending | 2 / 25 |
| Students without `academic_year_id` | 19 |
| Lesson plans | 0 |
| Exams | Grade 1 (`"2026 - 2027"`, not submitted), Grade 12 (submitted; no students in Grade 12), Grade 4 (submitted) |
| Exam approvals | 2 approved |
| Marks batches / entries | 1 (not submitted) / 1 |
| Marks or lesson-plan approvals | 0 |
| Class timetables | 1 (`CTT999`, Grade 1-A, year `"2025-2026"`, Approved) |
| Coordinator grade bands | 3 |

---

## 11. Notes

- Sections 0–11 are the original audit. Phase 1 changes are in section 12 and Phase 2 changes in section 13; later phases wait for approval.
- Unrelated to this audit, the working tree still has the earlier uncommitted admissions fix (parent email owned by another role).
- This file matches the `*.md` rule in `.gitignore` and is not allowlisted, so git will not pick it up unless it is added to the allowlist.

---

## 12. Phase 1 — Privacy fixes (27 Oct 2026)

**Scope:** AC-01, AC-02, AC-04 only. Backend authorization changes only: no frontend, schema, migration, configuration, grading or workflow changes. Nothing was committed, pushed or deployed. The live database was not used: all testing ran on in-memory or throwaway SQLite.

### 12.1 Root causes traced

| Finding | Frontend caller | Endpoint → permission check | Service / query | Root cause |
|---|---|---|---|---|
| AC-01 class result table | **None.** No page calls it; only `resultsApi.js` → `/results/students/{id}` is used. | `GET /api/v1/exams/{id}/results` → `require_permission("exams.read")`, which parents and students hold | `exams.exam_results` → `_load_exam` (campus check only) → `_exam_table` selects every student whose `class_name` equals the exam's | No role or relationship check; every row returned to any `exams.read` holder |
| AC-02 attendance roster | Teacher/Coordinator `ClassAttendance.jsx` and dashboards (staff only). Portal pages use only the per-child calendar. | `GET /api/v1/attendance` → `require_permission("attendance.read")`, which parents and students hold | `attendance.list_attendance` / `roster_with_marks` filter only by the `className`/`section` the caller sends | Caller-chosen class with no role check |
| AC-04 teacher results | Coordinator `StudentResultDetails.jsx` (reached from the already-scoped student list) | `GET /api/v1/results/students/{id}` → `results.read` | `exams.student_results`: `role != "teacher"` gate only | `GET /students/{id}` applies the roster scope (class-teacher sections + Teacher Allocation), but results did not. Same gap in `attendance.student_month_map` (calendar). |

### 12.2 Changes made

| File | Change |
|---|---|
| `backend/app/services/students.py` | New `staff_student_filter()` and `ensure_staff_can_view_student()`: the **existing** student-record rule (teacher: class-teacher sections + allocation mappings; coordinator: grade band or allocations), moved into one place. `get_student()` now calls it, so its behaviour and error messages are unchanged. |
| `backend/app/services/exams.py` | `exam_results()`: parents and students get **403**; other roles outside staff get 403. Teachers and coordinators get only the rows of students they may open, and 403 if they can open none in that class. Rank and class high are still computed class-wide. `student_results()`: after the existing parent/student ownership checks, staff go through `ensure_staff_can_view_student()`. |
| `backend/app/services/attendance.py` | `list_attendance()` and `roster_with_marks()` refuse parents and students with **403** before any query (roster refusal comes before the class-label repair write). `student_month_map()` (calendar) applies `ensure_staff_can_view_student()` after the existing parent/student checks. |
| `backend/tests/test_academic_privacy.py` | New: 26 regression tests (§12.3). |

Access after Phase 1:

| Role | `GET /results/students/{id}` | `GET /exams/{id}/results` | `GET /attendance` | Attendance calendar |
|---|---|---|---|---|
| Parent | own linked child (else 404) | **403** | **403** | own linked child (else 404) |
| Student | self (else 404) | **403** | **403** | self (else 404) |
| Teacher | assigned students (else **403**) | assigned rows only; 403 if none | unchanged (see §12.5) | assigned students (else **403**) |
| Coordinator | grade band or allocations (else **403**) | in-scope rows only | unchanged | grade band or allocations (else **403**) |
| Principal, Director, Joint Director, Admin, Super Admin, MD | unchanged (campus-wide) | unchanged (full table) | unchanged | unchanged |

### 12.3 Regression tests (`backend/tests/test_academic_privacy.py`)

The test data is built once per module on the isolated in-memory test database:
- Grade 5 with section A (the demo teacher is class teacher) and section B
- three students with two separate families plus a student login: A and B in 5A, C in 5B
- one Director-approved exam
- marks published through Coordinator → Principal → Director (A 81, B 64, C 92)
- attendance marked for all three

The tests assert on the **returned data** (names, marks, ranks, calendar dates, row IDs), not only on status codes.

| Requirement | Test(s) |
|---|---|
| Authorized parent reads linked child's results | `test_parent_reads_only_linked_child_results`: A's own total 81, subject list, class-wide rank 2 |
| Parent denied another family's results | Same test: B gives 404, and the body contains neither B's name nor mark |
| Student denied another student's results | `test_student_reads_self_but_not_another_student`: self OK; B and C give 404 with no names |
| Authorized teacher reads assigned student | `test_assigned_teacher_reads_results_unassigned_is_denied` (A total 81); `test_teacher_access_follows_allocation_changes` (granting an allocation to 5B gives C's 92; removing it gives 403 again) |
| Teacher denied unassigned student | `test_assigned_teacher_reads_results_unassigned_is_denied`: C gives 403 with no name or mark; `GET /students/C` also 403 (same rule) |
| No whole-class results for parents/students | `test_parents_and_students_cannot_read_class_result_table`: parent A, parent B and student A all 403; no names, no `ADM-` numbers, no `results` key |
| Scoped staff class table | `test_teacher_class_table_is_limited_to_assigned_students` (rows exactly A and B, ranks 2 and 3, no C); `test_teacher_denied_class_table_for_unassigned_class` (403 after the class-teacher link is removed) |
| No attendance rosters for parents/students | `test_portal_roles_cannot_list_class_attendance`: 12 cases, parent and student × `className` spelled `Grade 5`, `5`, `V`, with and without `section`, with and without `roster=true`. All 403 with no names or `studentId`. |
| Attendance calendars | `test_attendance_calendar_scoping`: own child/self get `{2026-10-12: "P"}`; cross-family and other-student 404; teacher gets assigned A but 403 on C; principal can read C |
| Alternative endpoints | `test_alternative_endpoints_stay_closed_to_portal_roles`: `/marks-batches` (with and without `examId`), `/students`, `/students/{B}`, `/students?className=` give 403 for parent and student; `/parents/me/children` returns only A |
| Tampered / unknown identifiers | `test_tampered_or_unknown_identifiers_reveal_nothing`: unknown student UUID 404 on results and calendar for parent, student and teacher; unknown exam gives 403 for parent (refused before lookup) and 404 for principal; a malformed UUID gives 422 |
| Legitimate access preserved | `test_leadership_keeps_campus_wide_results` (admin, principal, director read C); `test_principal_class_table_is_complete` (all 3 rows in rank order, class high 92); `test_staff_attendance_lists_unchanged` (admin roster has all 3; teacher list unchanged); `test_coordinator_results_follow_grade_band` (band 1–4 gives 403, band 1–6 gives access) |

### 12.4 Test results

| Run | Result |
|---|---|
| New tests on the fixed code | **26 passed** |
| The same 26 tests on the **original code** (`HEAD`, temporary git worktree, since removed) | **20 failed, 6 passed**. The 6 passing tests cover behaviour that was already correct (own child, cross-family 404, leadership access, alternative endpoints), which confirms the other 20 detect the leaks. |
| Full backend suite `python -m pytest tests -q` | **458 passed, 34 skipped, 0 failed** (4 min 55 s). The previous baseline was 431 passed; the difference is the 26 new tests plus 1 earlier admissions test. |
| Isolated end-to-end audit script (§1) | **102 checks: 85 PASS, 15 FAIL, 2 INFO** (was 81/19/2). The 4 checks that flipped to PASS: parent class table 403, student class table 403, teacher out-of-roster results 403, parent attendance roster 403. The 15 remaining failures are other issues (AC-03, 05–08, 11–19). |
| Frontend build | Not run. No frontend files changed, and no parent/student page calls the endpoints that now return 403. |

### 12.5 Remaining / not changed in Phase 1

| Item | Why it was left | Next step |
|---|---|---|
| Teacher `GET /attendance` (list/roster) is not scoped to assignments | Teachers could **mark** attendance for any class, and scoping the read alone would break substitute marking. | **Done in Phase 2**: read and write scoped together (§13) |
| Teacher `POST /attendance` and marks entry are not scoped to assignments | Write-side permissions; not part of this phase | Attendance write **done in Phase 2**; marks entry is still AC-14 |
| Coordinator per-student results and calendar now follow the grade-band/allocation rule | This is the existing student-record rule. Coordinators still saw all marks batches. | Batches **scoped in Phase 2** (§13) |
| AC-03: portal reads of `/exams` (drafts) and `/academics/*` (all timetables, star ratings) | Not in this phase | **Done in Phase 2** (§13) |
| Browser confirmation of portal pages after the change | Not performed (no browser testing in this audit) | Manual item 11 in §9 |

---

## 13. Phase 2 — Academic access-control hardening (27 Oct 2026)

**Scope:** backend authorization and data visibility only. No frontend, schema, migration, configuration, grading or publication-policy changes. Nothing was committed, pushed or deployed. Phase 1 fixes and the earlier admissions fix are preserved (verified in the final diff and by their tests).

### 13.1 Inspection findings and root causes

| Area | What existed | Root cause |
|---|---|---|
| Substitute duty | **Nothing.** `backend/docs/API_BACKLOG.md:94` lists "Academics substitution" as deferred; `reports/daily-work-report.md:1391` says "emergency substitution not built". No model, endpoint or approval type. | Policy 1 cannot be implemented with existing data (AC-24, **BLOCKED**) |
| Candidate records rejected as proof of substitute duty | `extra-classes` and `class-timetable-change-requests` are written by **teachers themselves**. `teacher-allocations` is admin-assigned but has no date or period, so it is a standing assignment, not a substitution. | Using them would let a teacher authorize themselves, or turn permanent allocations into substitutions |
| Attendance read | `list_attendance` / `roster_with_marks` returned any class to any staff role | No assignment check (teacher/coordinator) |
| Attendance write | `upsert_attendance` checked only that the student's class matched the client-supplied `className` | Client-chosen class, no assignment check, no section check; a failing student in the middle of a batch could leave earlier rows queued |
| Marks batches | `exams._own_or_all`: owner **or** any role in `VIEW_ALL_ROLES` (which includes coordinator) | Coordinator treated as campus-wide |
| Marks approvals | `approvals.inbox/_get/decide/lookup` checked only the role and the chain level | No link to the batch's scope; any coordinator could open or approve any batch's request by id |
| Exams for portal roles | `list_exams` / `get_exam` returned every exam on the campus, including drafts | No publication or class filter |
| Academics collections for portal roles | `list_records` returned the whole campus collection to anyone in `_READERS` (which includes parent and student) | No per-user filtering |

### 13.2 Changes made (files and functions)

| File | Function(s) | Change |
|---|---|---|
| `backend/app/services/students.py` | new `PORTAL_ROLES`, `portal_students()`, `class_key()`, `section_key()` | One shared definition of "the students this parent/student login is linked to". Phase 1's `staff_student_filter()` / `ensure_staff_can_view_student()` are reused unchanged. |
| `backend/app/services/attendance.py` | `_class_list_scope()` (replaces Phase 1's `_refuse_portal_class_lists`), `list_attendance()`, `roster_with_marks()`, `upsert_attendance()`, `student_month_map()` | Portal roles still get 403. Teachers/coordinators get only students the shared helper allows. A roster for a class with students but none in scope gives 403; a partly in-scope request is narrowed. **Writes:** every student is validated against the authenticated user's scope (from the database, not the request) **before any row is written**. Out-of-scope gives 403; a placed student relabelled into another section gives 400. Admin, principal, director and other unscoped roles are unchanged. |
| `backend/app/services/exams.py` | new `_portal_exam_filter()`, `_batch_in_scope()`, `batch_visible()`, `marks_batch_visible_by_id()`; changed `list_exams()`, `get_exam()`, `_load_batch()`, `list_batches()`; removed `_own_or_all()` | **Exams:** parents/students see only exams that are Director-approved **and** for a class their linked students are in; other ids give 404. **Batches:** visible to the owner, to campus-wide leadership (principal, director, jointdirector, admin, superadmin, managing_director), or to a coordinator only if the batch's class/section **and every student in it** pass the shared coordinator rule (grade band or allocations). The list and detail endpoints use the same function. Phase 1's duplicate `PORTAL_ROLES` now comes from `students.py`. |
| `backend/app/services/approvals.py` | new `_entity_visible()`; changed `_get()` (used by detail and decide), `inbox()`, `lookup()` | `marks_batch` approvals follow `batch_visible()`. Out-of-scope requests are left out of the inbox and give 404 on detail and decide (as if they don't exist). The role-at-level, no-self-decision and deny-reason rules are unchanged, so reading a batch never grants approval authority. |
| `backend/app/services/academics_collections.py` | new `_timetable_for_student()`, `_portal_items()`; changed `list_records()` | For parent/student only: `class-timetables` are filtered to the linked child's class and section, or whole-class entries, using the same matching as the portal timetable page. `student-star-ratings` are filtered to the family's own `studentId`s. `teacher-allocations` and `class-timetable-change-requests` return an **empty list** (200, not 403, because the portal timetable page loads change requests in parallel with timetables). Staff lists are unchanged. |
| `backend/tests/test_academic_access_phase2.py` | new | 21 regression tests (§13.5) |
| `backend/tests/test_exams.py` | new helper `_coordinator_band()`, used in `_publish()` and the deny/revise test | These tests make the demo coordinator approve marks. Under Policy 2 that needs a grade band, so the helper gives one (1–12) through the real `PUT /students/coordinator-grade-bands`. No assertion was removed. |
| `backend/tests/test_academic_privacy.py` | fixture + `test_coordinator_results_follow_grade_band` | Fixture sets the coordinator band before marks approval; the band test restores it afterwards. All Phase 1 assertions are kept. |
| `backend/tests/test_attendance.py` | `test_teacher_can_mark_attendance` → `test_teacher_can_mark_attendance_only_for_assigned_class` | The old test asserted that an **unassigned** teacher may mark any class, which the confirmed policy forbids. The new test asserts refusal (403, no row written) before assignment and success after the teacher is made class teacher. |

### 13.3 Rules now enforced (backend)

**Attendance (Policy 1).** A teacher may read and mark only students in:
- sections where they are class teacher (`sections.class_teacher_user_id`), or
- active Teacher Allocation mappings linked to their login (by HR code or email).

A coordinator may also act within their grade band. No other source grants access: request fields such as `className`, `section` or `substituteFor`, teacher-written records, and inactive or other users' allocations are all ignored. Substitute duty is **not available** (BLOCKED, §13.4).

**Coordinator marks (Policy 2).**

| Action | Coordinator in scope | Coordinator out of scope | Principal / Director / Joint Director / Admin |
|---|---|---|---|
| `GET /marks-batches` (with or without `examId`) | listed | not listed | all listed |
| `GET /marks-batches/{id}` (entries, marks) | 200 | **404** | 200 |
| `GET /approvals/inbox` | listed when awaiting coordinator | not listed | unchanged (by role) |
| `GET /approvals/{id}`, `/approvals/lookup` | visible | **404** / empty | visible |
| `POST /approvals/{id}/decide` | allowed at the coordinator step | **404**, state unchanged | only at own step (403 otherwise); jointdirector/admin are not in the chain, so 403 |
| `GET /exams/{id}/results` (Phase 1) | in-scope rows | 403 when none in scope | full table |

**Exams and timetables (AC-03).**

| Data | Parent | Student | Staff |
|---|---|---|---|
| `GET /exams`, `GET /exams/{id}` | approved exams for their children's classes; anything else gives 404 | approved exams for own class | unchanged (all, incl. drafts) |
| `class-timetables` | child's class + section, or whole-class entries | own class + section | unchanged |
| `student-star-ratings` | own children only | self only | unchanged |
| `teacher-allocations`, `class-timetable-change-requests` | empty list | empty list | unchanged |

"Published exam" = Director-approved `exam_timetable`, as defined in the `exams.py` module docstring and used by marks entry. No new publication rule was introduced.

### 13.4 Substitute duty — blocker and proposed minimal implementation (not built)

**Status: BLOCKED.** The policy requires an explicit administrator-assigned substitute duty for a class/section and date or period. Nothing in the codebase records that. Building one is a schema/workflow change that needs approval. Smallest safe proposal:

1. **Model:** new table `substitute_duties`, with:
   - `id`, `campus_id`, `teacher_user_id` (FK users)
   - `class_id` (FK school_classes), `section_id` (FK sections)
   - `duty_date`, optional `period`
   - `assigned_by` (FK users), `status` (`active`/`revoked`), `revoked_at`, `created_at`
   - one Alembic migration
2. **Who assigns:** roles that can already write teacher allocations (principal, director, admin, superadmin, managing_director). No new approval chain is invented; if the school wants one, it must be specified.
3. **API:** `POST /api/v1/substitute-duties`, `GET` (assigners: campus; teacher: own), `POST /{id}/revoke`.
4. **Enforcement:** extend `staff_student_filter()` for teachers with **today's** active, non-revoked duties of the authenticated user, but only for attendance reads and writes (pass the attendance date). Results, marks and student records stay on the standing scope.
5. **Tests:** these cases are already written, using today's rejection outcome, and would flip to access once a valid duty exists: wrong date, revoked, other teacher, other section.

**Open questions before building:** Is a substitute limited to the duty **date** only, or to a period/time window? Can a coordinator assign duties? Should a substitute see the class's past attendance or only the duty date?

### 13.5 Regression tests (`backend/tests/test_academic_access_phase2.py`)

The test data is built on the isolated in-memory SQLite test database (`reset_sqlite_memory_schema()`):
- Grade 5 A (demo teacher is class teacher) and 5B; Grade 8 A
- students A and B in 5A, C in 5B, D in 8A; four separate families and a student login
- approved exams for Grade 5 and Grade 8
- submitted batches: 5A Maths (A, B), 5A Science (A **and** C), 8A Maths (D)

Assertions check returned ids, names and marks, plus side effects (rows written or not, approval level and status unchanged).

| Requirement | Test | Result |
|---|---|---|
| Class teacher: roster read + write | `test_class_teacher_reads_and_marks_own_section`: roster is exactly A and B; a whole-class request is narrowed; marked rows are visible to admin | PASS |
| Allocated teacher preserved; revoked denied | `test_allocated_teacher_access_follows_allocation`: 403 before; allocation gives C in roster and the write lands; revoke gives 403 read and write, no row | PASS |
| Expired/revoked and mismatched assignment | `test_inactive_or_mismatched_allocation_grants_nothing[Inactive / other user]`: 403, no name, no row | PASS |
| Unassigned teacher; self-declared duty | `test_unassigned_teacher_cannot_read_or_mark_and_self_declared_duty_does_not_count`: teacher-written extra-class and change-request plus a `substituteFor` field still give 403, no row | PASS |
| Valid substitute assignment allowed | — no mechanism exists | **BLOCKED** (AC-24) |
| Identifier tampering | `test_identifier_tampering_cannot_widen_teacher_access`: other-class student under own class (400), naming other class (403), mixed batch (403, **nothing written**, including the allowed student), section relabel (400), `V` spelling (403) | PASS |
| Teacher unfiltered list (dashboard path) | `test_teacher_unfiltered_list_only_returns_assigned_students` | PASS |
| Admin/principal unchanged | `test_admin_and_principal_attendance_unchanged` | PASS |
| Portal roster denied; own calendar kept | `test_portal_roles_still_denied_rosters_but_keep_own_calendar` | PASS |
| Coordinator in band: list + detail + marks | `test_coordinator_sees_only_batches_in_grade_band` | PASS |
| Coordinator out of band: detail, inbox, detail-by-id, lookup, decide | `test_coordinator_cannot_open_or_approve_out_of_band_batch`: 404/absent/empty; approval still pending at level 0; no marks or names in bodies | PASS |
| Read ≠ approval authority; leadership access | `test_reading_a_batch_does_not_grant_approval_authority`: principal, director, jointdirector, admin all read the 8A batch (marks 91) but get 403 deciding out of turn | PASS |
| Allocation-scoped coordinator | `test_allocation_scoped_coordinator_needs_every_student_in_scope`: 5A batch visible; batch containing a 5B student hidden (404) | PASS |
| Approval sequence intact | `test_full_approval_sequence_still_publishes`: principal before coordinator 403; C → P → D publishes; parent sees 77; moving the band to 7–12 makes the Grade 8 batch approvable and publishes 91 to its parent | PASS |
| Teacher/portal marks restrictions | `test_teacher_and_portal_marks_restrictions_unchanged` | PASS |
| Portal: drafts denied, own-class published allowed | `test_portal_sees_only_approved_exams_for_own_class`: list = {approved Grade 5}; draft, pending and Grade 8 ids give 404; Grade 8 parent sees only the Grade 8 exam | PASS |
| Staff exam access | `test_staff_exam_lists_unchanged` | PASS |
| Portal timetables by class/section | `test_portal_timetables_limited_to_childs_class_and_section`: 5A gives {TT-5A, TT-5}; 5B gives {TT-5B, TT-5, TT-MIX (5B timeline row)}; 8A gives {TT-8A} | PASS |
| Staff timetable access | `test_staff_timetable_access_preserved` | PASS |
| Staff-only lists and star ratings | `test_portal_gets_no_staff_lists_and_only_own_star_ratings` | PASS |
| No portal writes or alternate collections | `test_portal_cannot_write_or_reach_hidden_timetables_another_way` | PASS |

### 13.6 Test results

| Run | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| New Phase 2 tests (fixed code) | **21** | 0 | 0 | substitute "allowed" case not written (AC-24) |
| Same 21 tests on unmodified `HEAD` (temporary git worktree, removed afterwards) | 5 | **16** | 0 | — |
| Phase 1 privacy tests (`test_academic_privacy.py`) | **26** | 0 | 0 | — |
| 13 affected academic suites (exams, attendance, admin attendance, approvals, collections, 5 portal suites, lesson plans, students, privacy) | **66** | 0 | 0 | — |
| **Full backend suite** `python -m pytest tests -q` | **479** | **0** | **34** | — |
| Isolated end-to-end audit script | **88** of 103 checks | 13 | — | — |

On `HEAD`, the 5 that pass are the "preserved access" tests (admin attendance, leadership read without approval authority, staff exam and timetable lists, portal write refusal), as expected.

**About the 34 skips:** all three migration test files (`test_migration_hr_user_id`, `test_migration_class_details`, `test_migration_class_academic_year`) skip with `PostgreSQL not reachable for the migration tests: ProgrammingError`. These pre-existing tests read the Postgres URL from `backend/.env` and try to `CREATE DATABASE qmis_test_mig_<random>` (a separate scratch database, never `qmis_erp`). The `qmis_app` user is not allowed to create databases. A read-only check of `pg_database` afterwards showed no `qmis_test_mig_*` database (only `qmis_erp` and a pre-existing `qmis_academic_browser`). All other suites use in-memory SQLite.

**The 13 end-to-end failures** are all later-phase items: AC-07, 08, 12, 13, 14, 16, 17, 18, 19 and progress reports. The script now gives its coordinator a 1–6 band before marks approval, mirroring the dev database.

**Frontend build:** not run, because no frontend files changed.

**Live database:** no write tests. Read-only checks only, inside `SET TRANSACTION READ ONLY`:
- all three dev coordinators have bands (1–6, 5–8, 9–12), so marks approval is not blocked there
- 0 pending marks approvals were affected

### 13.7 Remaining issues and policy questions

| Item | Status | Note |
|---|---|---|
| Substitute duty (AC-24) | **BLOCKED** | Needs approval of the §13.4 design and answers to its questions |
| Lesson-plan approvals for coordinators (AC-25) | **Resolved in Phase 3A** | §14 |
| Notification broadcast to all users of a role (AC-26) | **Resolved in Phase 3A** for scoped steps | §14 |
| Class-content collections for portal users (AC-27) | **Resolved in Phase 3A** | The forms require exactly one class and section; §14 |
| Portal timetables with Pending status | **Resolved in Phase 3A** | Parents/students see Approved only; §14 |
| Unplaced students' timetable | Decided conservatively | A student with no section sees only whole-class timetables. Confirm. |
| Teacher Class Attendance screen offers every class (AC-28) | **Resolved in Phase 3A** | §14 |
| Teacher marks entry not scoped to allocation (AC-14) | Open | Write-side, later phase |
| Browser verification of Phase 1 and Phase 2 screens | NOT TESTED | §9 items 11 and 13 |

---

## 14. Phase 3A — Remaining academic access policies (27 Oct 2026)

**Scope:** AC-25, AC-26, AC-27, published-only timetables, AC-28. **No schema or migration changes and no substitute-duty work.** Phase 1/2 fixes, the earlier admissions fix and unrelated local files are preserved (final diff reviewed). Nothing was committed, pushed or deployed. The live database was only read (read-only transactions).

### 14.1 Root causes

| Item | Root cause |
|---|---|
| Lesson plans (AC-25) | `lesson_plans._load()` and `list_plans()` let every role in `VIEW_ALL_ROLES` (which includes coordinator) open and list every plan on the campus. The approval endpoints had no lesson-plan scope check (Phase 2 covered `marks_batch` only). |
| Notifications (AC-26) | `approvals._notify(role_code=…)` writes **one** row per step that every user of that role sees (`list_notifications`: `user_id is None and role_code == role`). For the coordinator step of marks and lesson plans, that reached coordinators who cannot open or decide the record. |
| Class content (AC-27) | `academics_collections.list_records()` returned these six collections whole to parent/student logins. The only filtering was in the browser (`studentClassMatch.js`), which treats a blank class as a wildcard, matches Grade 1 to Grade 10–12, and is skipped on view-by-id pages. |
| Pending/denied timetables | The Phase 2 portal filter checked class/section only. The portal page prefers Approved but falls back to Pending/Denied rows when no Approved row exists (`TimeTableDetails.jsx:20-24`). |
| Class Attendance screen (AC-28) | `ClassAttendance.jsx` used the hardcoded `CLASSES`/`SECTIONS` lists from `attendanceData.js:13-14` (`['Grade 1', 'Grade 2', 'Grade 3', '9', '10']` and `['A', 'B']`). No endpoint gave the signed-in teacher their own classes. |

### 14.2 Approval notification flow, per workflow

| Workflow | Chain (from `approvals.WORKFLOWS`) | Next-step recipients after Phase 3A |
|---|---|---|
| `marks_batch`, `lesson_plan` | coordinator → principal → director | **Coordinator step:** one per-user notification to each active coordinator who can open the record (grade band or allocations), excluding the submitter. **Principal/director steps:** unchanged role delivery (campus-wide roles; every holder may act). |
| `exam_timetable`, `timetable`, `academic_calendar` | director | unchanged role delivery |
| `store_request` | principal → stationerystoremanager | unchanged role delivery |
| `section_change` | coordinator → principal → director | unchanged role delivery. Its `entityId` is free text with no linked record (`test_approvals.py:36`), so there is no class to scope by. Listed as open (§14.7). |
| `gate_pass`, `leave_request` | supplied by the caller / the leave service | unchanged |
| Decision results (approved/denied) | — | unchanged: per-user to the submitter |

The delivery mechanism is the same `Notification` table and `GET /api/v1/notifications` endpoint. Per-user rows (`user_id`) were already used for submitter notices. Notification titles and bodies contain only exam/subject/class/month and the submitter's email; tests assert that no student name, id or mark appears.

### 14.3 Class content audit

There is no relational model: all six are untyped JSON items in `academics_records` (`collection`, `public_id`, `body`), with list `GET /api/v1/academics/{collection}` and whole-list replace `PUT`. There are **no detail endpoints**: portal "view by id" pages look items up in the list, so the list filter also covers them.

| Collection | Staff form (class/section) | Portal page | Previous portal visibility | Scope established by existing data? | Data-model change needed? |
|---|---|---|---|---|---|
| home-fun | `HomeFunForm.jsx:66-77`: one `className` + one `section`, both required | `/student|parent/student-deliverables/home-fun` (+ `view/:id`) | whole campus | **Yes**, class + section | No |
| study-materials | `StudyMaterialForm.jsx:67-75`: required class + section | `/…/study-materials` (+ `view/:id`) | whole campus | **Yes** | No |
| sample-questions | `SampleQuestionForm.jsx:68-76`: required class + section | `/…/sample-questions` (+ `view/:id`) | whole campus | **Yes** | No |
| unit-tests | `UnitTestForm.jsx:145-156`: required class + section | **none** (no portal route) | whole campus via API | **Yes** | No |
| extra-classes | `ExtraClassForm.jsx:191-201`: required class + section; `AddExtraClass.jsx:14-25` rejects blanks | `/…/class/extra-class` | whole campus | **Yes** | No |
| online-classes | `OnlineClassForm.jsx:73-85`: required class + section | `/…/class/online-class` | whole campus (incl. teacher email) | **Yes** | No |

No form offers "All", multiple classes or a blank class, and no campus-wide content convention exists. Rows without a class or section can only come from direct API writes, tests or legacy data. They are **hidden from parents and students** (fail closed), not shown to everyone. A read-only check of the dev database found **0 rows** in these six collections, so nothing currently visible was hidden.

**Proposal for approval (not built):** if the school wants campus-wide or multi-class content, add an explicit audience field (for example `audience: "class" | "campus"` plus `classSections: [...]`) to the forms and to this filter, instead of reading meaning into blank fields.

### 14.4 Changes made

| File | Function(s) | Change |
|---|---|---|
| `backend/app/services/lesson_plans.py` | new `plan_visible()`, `plan_visible_by_id()`; changed `_load()`, `list_plans()` | Owner, campus-wide leadership, or a coordinator whose grade band/allocations (Phase 1 `staff_student_filter`) cover the plan's class/section. Detail, edit, submit, complete and revise all go through `_load()`, so out-of-scope gives **404**. |
| `backend/app/services/approvals.py` | `_entity_visible()` (+ `lesson_plan`); new `SCOPED_ENTITY_TYPES`, `SCOPED_APPROVER_ROLES`, `_notify_step()`; `submit()` and `decide()` use `_notify_step()` | Inbox, detail, lookup and decide hide/refuse out-of-scope lesson-plan approvals (as Phase 2 does for marks). The coordinator step of scoped records is notified per eligible user; every other step keeps role delivery. |
| `backend/app/services/academics_collections.py` | new `_timetable_published()`, `_content_for_student()`, `_CLASS_CONTENT_COLLECTIONS`, `_PORTAL_HIDDEN_FIELDS`; `_portal_items()` | **Portal only:** timetables must be `approvalStatus == "Approved"` (the only published state the app writes: `classTimetableData.js:517, 561, 699, 712, 719`). The six content collections must match the child's class **and** section (normalized, e.g. `V`/`a` = Grade 5/A); rows missing either are hidden. `studentDetails` is removed from home-fun items. Any collection not explicitly handled returns `[]` for portal roles. Staff responses are unchanged. |
| `backend/app/services/attendance.py` | new `my_attendance_classes()` | Current-year active classes and sections, kept only where the **same predicate as roster/save** allows a probe of that class/section. Portal roles get 403. Unscoped roles (admin, principal, …) get the full catalog with `scoped: false`. |
| `backend/app/api/v1/endpoints/attendance.py` | new `GET /api/v1/attendance/my-classes` | `attendance.read` permission; returns `{scoped, classes: [{className, sections[]}]}` |
| `src/services/attendanceApi.js` | new `listMyAttendanceClassesApi()` | — |
| `src/Pages/Teacher/Attendance/ClassAttendance.jsx` (also used by Coordinator) | class/section dropdowns | In API mode the options come from `/attendance/my-classes`; sections follow the chosen class; an empty list shows "No classes are assigned to you for attendance." Local demo mode keeps the old lists. The backend still enforces every roster read and save. |
| `backend/tests/test_lesson_plans.py` | new `_coordinator_band()` used before coordinator decisions | These tests passed in the full run only because another module had left a coordinator band in the shared in-memory DB. Run alone, they failed after the change, so the band is now set explicitly. No assertion was removed. |
| `backend/tests/test_academic_access_phase3a.py` | new | 19 regression tests (§14.5) |

**Substitute duty:** the endpoint returns only standing assignments. When a substitute-duty model is approved (§13.4), its date/period-limited assignments belong in `staff_student_filter()`, so roster, save and this options list pick them up together.

### 14.5 Regression tests (`backend/tests/test_academic_access_phase3a.py`)

The test setup runs on an isolated in-memory DB. It has the demo coordinator (band 1–6), a second coordinator created through `POST /admin/users` (band 7–12), Grade 5 A (teacher is class teacher), Grade 5 B, Grade 8 A and B, and placed students A (5A), C (5B) and D (8A) with separate families.

| Requirement | Test | Result |
|---|---|---|
| Coordinator lesson plans: allowed and denied, list and detail; inbox, detail-by-id, lookup, decide denied; state unchanged | `test_coordinator_lesson_plans_follow_grade_band` | PASS |
| Approval sequence intact (principal before coordinator 403; C → P → D for both bands) | `test_lesson_plan_approval_sequence_intact_for_in_scope_coordinators` | PASS |
| Principal, director, jointdirector, admin, owner read; jointdirector/admin cannot decide | `test_leadership_and_owner_lesson_plan_access_preserved` | PASS |
| Out-of-scope submit and identifier changes (unknown id 404, malformed 422, portal 403); draft unchanged | `test_out_of_scope_coordinator_cannot_submit_or_reach_by_identifier` | PASS |
| Coordinator step notifies only the in-scope coordinator (DB rows: one `user_id`, no `role_code`); the other sees nothing | `test_coordinator_step_notifies_only_in_scope_coordinators` | PASS |
| Principal step and unscoped workflows (exam timetable → director) keep role delivery | `test_next_campus_wide_step_still_uses_role_delivery` | PASS |
| Marks: only the eligible coordinator notified; no student name, id or mark in title/body; a submitting coordinator is not notified | `test_marks_notifications_reach_only_eligible_coordinator_and_carry_no_student_data` | PASS |
| Class content × 6 collections: 5A family sees 5A + `V`/`a`; 5B and 8A families see their own; no-class and no-section rows hidden; staff see all 6 | `test_class_content_scoped_to_childs_class_and_section[…]` (6) | PASS |
| `studentDetails` stripped for portal, kept for staff | `test_home_fun_submission_details_never_reach_portal` | PASS |
| Timetables: Approved shown; Pending, Denied and status-less hidden; another class's Pending hidden; staff see all; change requests empty for portal, present for staff | `test_portal_sees_only_approved_timetable_versions` | PASS |
| Attendance options: teacher gets only 5A; allocation adds 8B; revoking removes it | `test_teacher_options_list_only_assigned_sections` | PASS |
| Coordinators get their band's sections; principal/admin full and `scoped: false`; portal 403 | `test_coordinator_and_leadership_options` | PASS |
| Every listed option loads its roster; unlisted section roster 403; unauthorized write 403 with no row | `test_every_listed_option_loads_and_unlisted_ones_are_refused` | PASS |
| Teacher with no assignments gets no options | `test_teacher_without_assignments_gets_no_options` | PASS |
| Substitute duty shown only for its date/period | — no mechanism exists | **BLOCKED** (AC-24) |

### 14.6 Test results

| Run | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| New Phase 3A tests | **19** | 0 | 0 | substitute case (AC-24) |
| Same 19 on unmodified `HEAD` (temporary worktree, removed) | 2 | **17** | 0 | — |
| Affected suites individually (each file alone): lesson plans 7, approvals 5, exams 4, attendance 2, Phase 1 privacy 26, Phase 2 21, collections 8, teacher portal 2 | **75** | 0 | 0 | — |
| **Full backend suite** | **498** | **0** | **34** | — |
| Frontend `npm run build` | exit 0, `✓ built in 58.39s` | — | — | — |

On `HEAD`, the 2 that pass are the preservation tests (approval sequence, leadership/owner access). The 34 skips are the same three PostgreSQL migration files described in §13.6. Phase 1 (26) and Phase 2 (21) regression tests still pass.

**Read-only dev-DB impact check:** 0 class-content rows; 1 class timetable (Approved), so it is still visible to its families.

### 14.7 Unresolved items and policy decisions

| Item | Status | Question / proposal |
|---|---|---|
| Substitute duty (AC-24) | **Implemented in Phase 4** | §15; live migration awaits approval |
| A coordinator who submits marks or a lesson plan | **Resolved in Phase 4** | Routed to the Principal (§15.2) |
| A class with no coordinator band covering it | **Resolved in Phase 4** | The step waits, shows `awaitingEligibleApprover`, and alerts the administrator (§15.2) |
| `section_change` notifications | Open | No linked record, so it cannot be scoped. It needs a real entity (student id) before recipients can be narrowed. |
| Editing an approved timetable | Data-model limitation | Editing sets the same record back to `Pending`, so families see no timetable until it is re-approved (no separate published version). Keeping the last approved version visible needs a versioned record; proposal only. |
| Campus-wide or multi-class content | Proposal (§14.3) | Explicit audience field, if the school wants it |
| Browser verification of Phase 1–3A screens | NOT TESTED | §9 items 11, 13, plus: Teacher/Coordinator Class Attendance dropdowns; Parent/Student Home Fun, Study Materials, Sample Questions, Extra and Online Class, Timetable |

---

## 15. Phase 4 — Approval edge cases and substitute duty (27 Oct 2026)

### 15.1 Substitute-duty design (recorded before the schema change)

| Part | Design |
|---|---|
| **Model** | New table `substitute_duties`: `id` (UUID), `campus_id` → campuses, `teacher_user_id` → users, `class_id` → school_classes, `section_id` → sections, `duty_date`, `period` (label, e.g. "P3"), `start_time`, `end_time`, `status` (`active`/`revoked`), `note`, `assigned_by` → users, `created_at`, `revoked_by` → users, `revoked_at`, `revoke_reason`. Check constraint `start_time < end_time`; index on (campus, teacher, date). No existing table changes. |
| **Why explicit times** | Attendance is stored **per student per day** (`student_attendance.attendance_date`, no period column), and no period master exists (timetable periods are free text inside JSON). The only safe way to enforce "valid only for the assigned period" is an explicit time window on the assignment, checked against campus-local time. |
| **Campus time** | New setting `campus_timezone` (default `Asia/Kolkata`, the school's location in `src/constants/schoolProfile.js`). Existing configuration values are unchanged. |
| **Migration** | Alembic `0020_substitute_duties` (revises `0019_admission_zip_widen`), guarded so it is a no-op if the table already exists. |
| **Endpoints** | `GET /api/v1/substitute-duties/options` (assigners: teachers + current-year classes and sections); `GET /api/v1/substitute-duties` (assigners: campus; teacher/coordinator: own only); `POST /api/v1/substitute-duties` (assign); `POST /api/v1/substitute-duties/{id}/revoke`. No new permission is added: assign/revoke require `attendance.write` **and** an assigner role. |
| **Assigner roles** | principal, director, admin, plus superadmin and managing_director. These are the admin-tier roles that already hold every admin permission, and the same set already allowed to write Teacher Allocations (`academics_collections._FULL_WRITERS`). Teachers and coordinators cannot assign or revoke. |
| **Access granted** | **Attendance only**: roster read, class list read and attendance write, for the duty's section, when the request's date **is** the duty date, today (campus time) is that date, and the current time is inside the window. No calendar or history, no student records, results, marks or lesson plans. |
| **Audit** | Rows are never deleted. Assignment and revocation are kept on the row (`assigned_by`, `revoked_by`, `revoked_at`, `revoke_reason`) and written to `audit_logs` (`SUBSTITUTE_DUTY_ASSIGNED` / `SUBSTITUTE_DUTY_REVOKED`). |
| **UI** | New "Substitute Duty" page (assign, list, revoke) for Principal, Director and Admin. The Class Attendance screen lists a substitute section only while its duty is valid for the selected date and the current time. |
| **Live database** | **Not migrated in this phase.** The dev backend creates missing tables at startup (`Base.metadata.create_all` in `main.init_db`), so it was stopped before the model was added (§15.7). |

### 15.2 Part A — Approval routing rules (implemented)

State machine before this phase: `approval_requests` stores `chain_json` (list of roles), `current_level` and `status` (`pending`/`approved`/`denied`). `decide()` requires `role == chain[current_level]`, refuses the submitter, and advances or closes the request. Every step is recorded in `approval_events`.

| Rule | Implementation (`backend/app/services/approvals.py`) |
|---|---|
| A coordinator never approves their own marks batch or lesson plan | `decide()` now refuses the **submitter and the record's author** (`_entity_owner_id`: `marks_batches.teacher_id`, `lesson_plans.teacher_id`), and `eligible_approvers()` excludes both. |
| A coordinator's own submission skips the coordinator step | `_route_steps()` in `submit()`: for `marks_batch` / `lesson_plan` submitted by a coordinator, `coordinator → principal → director` becomes **`principal → director`** (replaced and de-duplicated, so there is never a second principal step). The submit event comment records it: "Submitted by a coordinator: the coordinator step is routed to principal>director." |
| Later stages preserved | The Director step remains; order is enforced by the existing `current_level` check. A teacher's submission keeps the full three-step chain. |
| No eligible approver | `_notify_step()` computes `eligible_approvers()` (active users of the step role on the campus who can open the record, excluding the submitter and author). If there are none, the request **stays pending at that step** (not skipped). An `admin` notification "No eligible approver: …" is sent (no student data) and an `APPROVAL_NO_ELIGIBLE_APPROVER` audit row is written. `awaitingEligibleApprover: true` appears on `GET /approvals/{id}`, on marks batches and on lesson plans. It is computed live, so it clears as soon as coverage exists (e.g. a grade band is added). No schema change was needed. |
| Backend enforcement | All in services; the UI is not involved. Existing grade-band/allocation scoping (Phases 2–3A) is unchanged. Audit history: events plus `audit_logs`. |
| Unchanged | Role-wide steps (principal, director, store manager, leave, exam timetables) still use role delivery; the admin alert is added only when nobody is eligible. `section_change` is not rerouted (§15.8). |

### 15.3 Part B — Substitute duty (implemented)

**Files:**
- `backend/app/models/substitute_duty.py`, registered in `app/models/__init__.py`
- `backend/alembic/versions/0020_substitute_duties.py`
- `backend/app/services/substitute_duties.py`
- `backend/app/api/v1/endpoints/substitute_duties.py`, mounted in `app/main.py`
- `backend/app/core/config.py` (new `campus_timezone`)
- `backend/app/services/attendance.py`
- `backend/app/api/v1/endpoints/attendance.py`

**Endpoints and permissions (no permission-matrix change):**

| Endpoint | Permission | Role rule |
|---|---|---|
| `GET /api/v1/substitute-duties/options` | `attendance.write` | assigners only (teachers + current-year classes/sections, `today` in campus time) |
| `GET /api/v1/substitute-duties?date=&includeRevoked=` | `attendance.read` | assigners: campus; teacher/coordinator: **own only**; others 403 |
| `POST /api/v1/substitute-duties` | `attendance.write` | assigners only. Body: `teacherUserId`, `classId`, `sectionId`, `date`, `period`, `startTime`, `endTime`, `note?` |
| `POST /api/v1/substitute-duties/{id}/revoke` | `attendance.write` | assigners only; optional `reason` |
| `GET /api/v1/attendance/my-classes?date=` | `attendance.read` | now also lists duty sections valid now for `date`, plus `substituteDuties[]` |

**Assigners:** principal, director, admin, superadmin, managing_director (the existing Teacher Allocation writers). Teachers and coordinators get **403** and nothing is created.

**Validation on assign:**
- The teacher must be an active teacher or coordinator login on the campus.
- The section must be active, on the campus, and **belong to `classId`**.
- The period must be 1–20 characters; times must be `HH:MM` with start < end (also a DB check constraint).
- The date must not be in the past (campus time).
- An active duty for the same teacher, section and date may not overlap (409).

**Access check (`attendance._class_list_scope`, used by `GET /attendance` list and roster, `POST /attendance`, and `my-classes`):** a duty adds its `section_id` to the standing class-teacher/allocation/grade-band predicate only when all of these hold:
- the authenticated user is the duty's teacher
- the status is `active`
- the request's attendance date = duty date = today (campus time)
- start ≤ now ≤ end

The calendar, student records, results, marks and lesson plans keep using the standing rule only, so a duty never exposes past attendance or other class data.

**History:** rows are never deleted. `assigned_by`/`created_at` and `revoked_by`/`revoked_at`/`revoke_reason` stay on the row (visible with `includeRevoked=true`), plus `SUBSTITUTE_DUTY_ASSIGNED` / `SUBSTITUTE_DUTY_REVOKED` audit rows.

**Frontend:**
- `src/services/substituteDutiesApi.js` and `src/Common/SubstituteDuties/SubstituteDuties.jsx` (assign form, list, revoke with optional reason, show-revoked toggle).
- Routes `/principal/academic/substitute-duty`, `/director/substitute-duty`, `/admin/class/substitute-duty`, with sidebar entries and header titles. No teacher or coordinator route.
- `ClassAttendance.jsx` requests options for the selected date, lists duty sections only while valid, and shows "Substitute duty: Grade 8-A, P3 (10:00–10:45) — available only during this period."

### 15.4 Migration details

| Item | Value |
|---|---|
| Revision | `0020_substitute_duties`, down-revision `0019_admission_zip_widen`; `alembic heads` returns `0020_substitute_duties (head)` |
| Upgrade | `schema_helpers.create_missing_tables(["substitute_duties"])`: creates the table from the model only if missing (no-op if startup `create_all` already made it) |
| Downgrade | `drop_tables_if_empty`: drops **only if the table is empty**, otherwise aborts (`MigrationAborted`) |
| Existing tables | Untouched |
| Verified on | A throwaway SQLite file (not Postgres): upgrade created the table with all 16 columns; a second upgrade was a no-op; downgrade with a row was refused (`MigrationAborted`); downgrade when empty dropped it |

### 15.5 Regression tests (`backend/tests/test_academic_phase4.py`, isolated in-memory DB; campus clock patched)

| Requirement | Test | Result |
|---|---|---|
| Teacher submission keeps coordinator → principal → director | `test_teacher_submission_keeps_the_full_chain` | PASS |
| Coordinator marks self-submission: chain principal → director, routing note, principal notified (role row), coordinator/out-of-band/out-of-order refused, published after P → D, event trail | `test_coordinator_marks_self_submission_routes_to_principal` | PASS |
| Coordinator lesson-plan self-submission routed and approved | `test_coordinator_lesson_plan_self_submission_routes_to_principal` | PASS |
| Missing coordinator coverage (Grade 11): stays at coordinator step, `awaitingEligibleApprover`, admin alert (no student name), audit row, principal/director/admin refused; adding a band clears it and the chain completes | `test_missing_coordinator_coverage_waits_and_alerts_admin` | PASS |
| Rerouted step with no active principal: waits, admin alert + principal role row, flag clears when the principal is active again | `test_rerouted_step_with_no_active_principal_waits_and_alerts_admin` | PASS |
| Unauthorized decisions (teacher 403, out-of-band coordinator 404, admin 403), level unchanged | `test_unauthorized_decisions_are_refused` | PASS |
| Assignment by principal, director, admin; refused for coordinator, teacher and a second coordinator with no row created; options endpoint assigner-only | `test_principal_director_admin_can_assign_coordinator_teacher_cannot` | PASS |
| Validation: past date, end before start, bad time format, empty period (422), section/class mismatch, non-teacher login, overlap (409) | `test_assignment_validation` | PASS |
| Valid substitute: no access at 09:59; at 10:15 options list Grade 8-A and the duty, roster = the duty student, write lands; at 10:46 access and option are gone | `test_valid_substitute_can_read_and_mark_only_during_the_period` | PASS |
| Wrong date (yesterday: read/write refused, nothing written), other section, other user, next day | `test_substitute_duty_is_limited_to_its_date_section_and_teacher` | PASS |
| No history or other data via duty (calendar, student record, results, student list) | `test_substitute_duty_grants_no_history_or_student_records` | PASS |
| Revocation: coordinator cannot revoke; director revokes; access removed immediately (read and write); second revoke 409; history keeps assigner, revoker, time, reason; audit row | `test_revocation_removes_access_immediately_and_keeps_history` | PASS |
| Duty visibility: teacher sees own, coordinator none, parent 403 | `test_duty_visibility_by_role` | PASS |
| Class-teacher access unchanged at 07:00, 10:00 and 18:00; parent roster 403; principal/admin unchanged | `test_standing_access_and_portal_blocks_unchanged` | PASS |

Allocated-teacher behaviour is covered by the existing Phase 2/3A tests, which still pass.

### 15.6 Test results

| Run | Passed | Failed | Skipped |
|---|---|---|---|
| New Phase 4 tests | **14** | 0 | 0 |
| Phase 1 privacy / Phase 2 / Phase 3A (each run on its own) | 26 / 21 / **19** | 0 | 0 |
| Lesson plans / attendance (each run on its own) | 7 / 2 | 0 | 0 |
| **Full backend suite** | **512** | **0** | **34** (same three PostgreSQL migration files, §13.6) |
| Migration 0020 helpers on throwaway SQLite | upgrade, no-op, guarded downgrade all as expected | — | — |
| Frontend `npm run build` | exit 0, `✓ built in 1m 22s` | — | — |

**Tests changed under the new rules (no assertions weakened):**
- Phase 3A `test_marks_notifications…`: a coordinator's own batch now notifies the Principal instead of nobody.
- Phase 3A options tests: the response now also contains `substituteDuties: []`.

**Not run against a pre-change baseline:** the Phase 4 test module imports the new `SubstituteDuty` model, so it cannot be collected on older code.

**Browser:** NOT TESTED. Screens to check: Principal/Director/Admin → Substitute Duty (assign, list, revoke), and Teacher → Class Attendance during and outside a duty window.

### 15.7 Live database — approval required

- The live `qmis_erp` database was **not changed**. A read-only check after the work showed **no `substitute_duties` table** and `alembic_version = 0019_admission_zip_widen`.
- To avoid an accidental schema change, the dev backend (uvicorn `--reload`) was **stopped** before the model was added: its startup runs `Base.metadata.create_all` against `qmis_erp`. **The backend is currently stopped.**
- **Approval needed:** restarting the backend (or running `alembic upgrade head`) will create the empty `substitute_duties` table in `qmis_erp`. Existing tables and rows are not touched. Until then, the substitute-duty endpoints and page will fail against the live database. The rest of the application is unaffected once the backend is restarted.

### 15.8 Remaining limitations

| Item | Status | Note |
|---|---|---|
| Attendance is daily, not per period | Architecture limitation | A substitute marks the class's **daily** attendance during the duty window and can overwrite an earlier mark for that day (as any authorized marker can). Every overwrite is now audited with its previous and new values (§15.10). Per-period attendance would need a new attendance model. |
| Campus timezone | Assumption | `campus_timezone = Asia/Kolkata` (school in Madurai). Change it in settings if the campus is elsewhere. |
| `section_change` workflow | Open | Coordinators can submit it with the same coordinator-first chain, so a coordinator's own request has no rerouting and is not scoped (no linked record). |
| Substitute notifications | Not implemented | Teachers are not notified when a duty is assigned or revoked; they see it on Class Attendance. |
| Admin alert recipients | Rule as given | Alerts go to the `admin` role only (not superadmin/managing_director). |
| Browser verification | NOT TESTED | §15.6 |

### 15.9 Pre-migration review (27 Oct 2026) — backend not started, live DB not written

**Method:**
- code inspection
- offline compilation of the migration's DDL with the PostgreSQL dialect (no connection)
- read-only queries on the live server (`SET TRANSACTION READ ONLY`, rolled back)
- the isolated test suites

No migration, DDL or write was run against PostgreSQL.

#### 1–3. Migration 0020

**Exact DDL** that `Table.create()` emits for PostgreSQL (compiled offline):

```sql
CREATE TABLE substitute_duties (
    id UUID NOT NULL, campus_id UUID NOT NULL, teacher_user_id UUID NOT NULL,
    class_id UUID NOT NULL, section_id UUID NOT NULL, duty_date DATE NOT NULL,
    period VARCHAR(20) NOT NULL, start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL, status VARCHAR(16) NOT NULL, note TEXT,
    assigned_by UUID NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_by UUID, revoked_at TIMESTAMP WITH TIME ZONE, revoke_reason TEXT,
    PRIMARY KEY (id),
    CONSTRAINT ck_substitute_duty_window CHECK (start_time < end_time),
    FOREIGN KEY(campus_id) REFERENCES campuses (id),
    FOREIGN KEY(teacher_user_id) REFERENCES users (id),
    FOREIGN KEY(class_id) REFERENCES school_classes (id),
    FOREIGN KEY(section_id) REFERENCES sections (id),
    FOREIGN KEY(assigned_by) REFERENCES users (id),
    FOREIGN KEY(revoked_by) REFERENCES users (id)
);
CREATE INDEX ix_substitute_duties_teacher_date ON substitute_duties (campus_id, teacher_user_id, duty_date);
```

| Check | Finding |
|---|---|
| Only the intended table | **PASS (code + compiled DDL).** `upgrade()` calls `create_missing_tables(["substitute_duties"])`, which creates only a table whose name is listed and only if it is missing, via `Base.metadata.tables[name].create()`. That emits exactly the DDL above: 1 table, its PK, 1 check constraint, 6 FKs and 1 index. |
| No modification, deletion, backfill or rewrite of existing tables/records | **PASS (code).** No `ALTER`, `UPDATE`, `INSERT` or `DELETE` on any other table. FKs only *reference* `campuses`, `users`, `school_classes` and `sections`. On PostgreSQL, adding them briefly takes a `SHARE ROW EXCLUSIVE` lock on those four tables; no rows change. |
| Live prerequisites (read-only) | PostgreSQL **18.6**; `alembic_version = 0019_admission_zip_widen`; `campuses.id`, `users.id`, `school_classes.id` and `sections.id` are all **`uuid`** (FK types match); **no** existing object named `substitute_duties`, `ix_substitute_duties_teacher_date` or `ck_substitute_duty_window`; `qmis_app` **may CREATE in schema `public`**. |
| Atomic | `env.py` runs online only, with `transaction_per_migration=True`; PostgreSQL DDL is transactional, so 0020 commits as one unit or rolls back. |
| Idempotent | A second `upgrade` (or one after startup `create_all` already made the table) creates nothing (verified on SQLite, §15.4). |
| Downgrade refuses while rows exist | **PASS (code + SQLite test).** `drop_tables_if_empty` counts rows first and raises `MigrationAborted` ("Downgrade refused; nothing was changed…") if any exist; otherwise `DROP TABLE "substitute_duties"`. Verified on SQLite (§15.4). |

#### 4. Attendance overwrite and history — RISK (not changed in this review)

- **A substitute can overwrite an existing daily mark.** `upsert_attendance()` finds the one `student_attendance` row per student per date and updates it in place: `status`, `in_out_status`, `class_name`, `section`, `marked_by_user_id`, `updated_at`. This is the same for every authorized marker (class teacher, allocated teacher, leadership); a substitute is no different.
- **Previous values are not recorded.** The only audit entry is `ATTENDANCE_UPSERT` with `entity_id = "<class>:<date>"` and `details = "<n> marks"`. No old status, new status or previous marker is stored, and no attendance history table exists (searched the models and services). After an overwrite, only the latest value and latest marker remain.
- **Recommendation (needs your decision; not implemented):** choose one before relying on substitute marking:
  1. Record per-student `old → new` status and the previous `marked_by` in the audit details (no schema change), **or**
  2. Refuse a substitute's change to a mark made by someone else that day (a workflow rule to confirm), **or**
  3. Add an attendance history table (schema change).

#### 5. `Asia/Kolkata` consistency

| Point | Finding |
|---|---|
| Assignment creation | **PASS.** The past-date check uses `local_now().date()` (campus zone). `start_time`/`end_time` are stored as wall-clock `TIME` with no zone, meaning campus time. |
| Start/end authorization | **PASS.** `_is_valid_now()` and `valid_duties()` compare `duty_date` and the window with `local_now()` in `settings.campus_timezone`, and require the request's attendance date to equal the campus date. India has no DST, so there is no ambiguity. |
| Expiry | **PASS.** No stored expiry; a duty is invalid once campus time passes `end_time` (end minute inclusive up to `HH:MM:00`) or the campus date changes. |
| Audit timestamps | `created_at` and `revoked_at` are UTC (`timestamptz`), like the rest of the app; the API returns ISO strings with offset. |
| UI display | **PASS with one risk.** The Substitute Duty page shows the server's `HH:MM` strings unchanged, takes "today" (date default and `min`) from the server's campus date, and uses the server-computed `validNow`. **Risk:** the Class Attendance screen derives the requested date from the **browser's** local date. A browser not set to IST around midnight could ask for a different date; the backend would then refuse (fail-closed), not over-grant. |
| Minor UX | Past duties that were never revoked still show "Scheduled" (status stays `active`; the list defaults to active rows). Suggest labelling them "Expired". Not changed. |

#### 6. Revocation

**PASS (code + test).** `revoke()` sets `status = 'revoked'` and commits. Every attendance read and write re-queries active duties through `valid_duties()` (no cache), so the next request is refused. `test_revocation_removes_access_immediately_and_keeps_history` asserts read 403 and write 403 right after revoking. An already-open screen keeps showing the option until it reloads, but the server refuses the action.

#### 7. Tested on PostgreSQL? — NOT TESTED (execution)

| Evidence | Status |
|---|---|
| DDL compiled with the PostgreSQL dialect | Done (above) |
| Live prerequisites checked read-only on PostgreSQL 18.6 | Done (above) |
| Upgrade/downgrade **executed** on a disposable PostgreSQL database | **NOT TESTED.** `qmis_app` has `rolcreatedb = false`, so no scratch database can be created with the current credentials; running DDL on `qmis_erp` was not allowed. Execution was verified on SQLite only (§15.4). |
| Opt-in test added | `backend/tests/test_migration_substitute_duties.py` runs **only** with `TEST_PG_URL` set explicitly and never falls back to `backend/.env`. It creates and drops its own `qmis_test_sub_*` database, and checks: the table is created and the second run is a no-op; the other tables are unchanged; the index, check constraint and FK targets; the check constraint rejects a bad window; downgrade is refused with a row and works when empty. It needs a role with CREATEDB (the row insert also uses `session_replication_role`, which needs a superuser). Current status: **skipped** (no `TEST_PG_URL`). |

#### 8. Screens, routes, permissions (code inspection only — no browser)

| Item | Finding |
|---|---|
| Frontend routes | `/principal/academic/substitute-duty` (`PrincipalRoutes.jsx`), `/director/substitute-duty` (`DirectorRoutes.jsx`), `/admin/class/substitute-duty` (`AdminRoutes.jsx`), all rendering `src/Common/SubstituteDuties/SubstituteDuties.jsx`; sidebar entries and header titles added. |
| Route guard | `App.jsx` sends each signed-in role only to its own prefix (e.g. a principal outside `/principal` is redirected; admin is limited to `/admin` and `/dashboard`). Teachers and coordinators have no route to this page. |
| Backend | `GET /substitute-duties/options`, `POST /substitute-duties` and `POST /{id}/revoke` need `attendance.write` **plus** an assigner role in the service. `GET /substitute-duties` needs `attendance.read`; assigners see the campus, teacher/coordinator their own, others 403. `GET /attendance/my-classes?date=` serves the teacher screen. All covered by `test_academic_phase4.py`. |
| Gap | Super Admin and Managing Director may assign through the API but have no screen (no route under `/super-admin`). |

#### 9. Preservation

Re-run with the review's new test file present: privacy (26), Phase 2 (21), Phase 3A (19), Phase 4 (14), admissions, approvals, lesson plans, exams and attendance gave **102 passed, 1 skipped** (the opt-in PostgreSQL test). The full suite last ran at **512 passed, 34 skipped, 0 failed** (§15.6); since then only this opt-in test file and the document changed. `git status` still shows the admissions fix and all Phase 1–4 changes; nothing is committed.

#### Recommended migration commands (for when you approve; not run)

From `C:\karan\QMIS\backend`, with the backend still stopped:

```powershell
# 0. Optional but recommended: backup (enter the password when prompted; do not put it on the command line)
pg_dump -h localhost -p 5432 -U qmis_app -Fc -f qmis_erp_pre_0020.dump qmis_erp

# 1. Optional: run the opt-in migration test against a disposable database (role with CREATEDB / superuser)
$env:TEST_PG_URL = "postgresql+psycopg://<privileged-user>:<password>@localhost:5432/postgres"
.\.venv\Scripts\python.exe -m pytest tests/test_migration_substitute_duties.py -q
Remove-Item Env:TEST_PG_URL

# 2. Confirm the starting point (expect 0019_admission_zip_widen)
.\.venv\Scripts\alembic.exe current

# 3. Apply only 0020 (explicit target rather than "head")
.\.venv\Scripts\alembic.exe upgrade 0020_substitute_duties

# 4. Confirm (expect 0020_substitute_duties (head))
.\.venv\Scripts\alembic.exe current

# 5. Start the backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000

# Rollback, only while the table is empty (refused otherwise):
# .\.venv\Scripts\alembic.exe downgrade 0019_admission_zip_widen
```

Notes:
- Run step 3 while nothing else is writing to `users`, `campuses`, `school_classes` or `sections`; the FK creation takes a brief lock on them.
- Starting the backend without step 3 would also create the table (startup `create_all`), but would leave `alembic_version` at 0019 until `alembic upgrade` runs (then a no-op that records 0020).
- Startup also runs the app's existing idempotent `ensure_*` schema helpers and demo seeding, unchanged by this work.

**Status: waiting for your explicit approval before the live migration.** The decision on attendance overwrite history (item 4) is also open. *(Resolved by §15.10: Option A approved and implemented.)*

### 15.10 Attendance change audit (Option A, 27 Oct 2026) — no schema change

**Gap (from §15.9 item 4):**
- `upsert_attendance()` updated the single per-day `student_attendance` row in place (status, in/out, class, section, `marked_by_user_id`).
- The only audit was one `ATTENDANCE_UPSERT` row per request, with details `"<n> marks"`.
- Previous values and the previous marker were lost.
- This affected every authorized marker, including substitutes.

**Write paths inspected:** `POST /api/v1/attendance` → `attendance.upsert_attendance()` is the **only** code that creates or changes `student_attendance` (searched every service). Class teachers, allocated teachers, coordinators, leadership and substitutes all use it.

**Implementation** (`backend/app/services/attendance.py`):

| Item | Behaviour |
|---|---|
| New record | `ATTENDANCE_CREATED` audit row. `previous: null`, `new` = initial values. |
| Changed record | The record's values are read **from the persisted row before it is modified** (`_audited_values`). After the change, an `ATTENDANCE_UPDATED` row records `previous`, `new` and `changed` (the fields that differ). An identical re-save by the same marker changes nothing and adds no change row. |
| Fields recorded | `entity_id` = attendance record id. `details` (JSON) holds `studentId` (UUID only, no names), `date`, and `status`, `inOutStatus`, `className`, `section`, `markedBy` (user id) for both `previous` and `new`, plus `changed`. `accessBasis` is `role` (campus-wide role), `assignment` (class teacher / allocation / grade band) or `substitute_duty`, the last with `substituteDutyId`. Actor = `actor_id`; timestamp = `created_at`; action type = `action`. |
| Reason/comment | Not supported: the attendance request has no reason field, so none is recorded. |
| Batch summary | The existing `ATTENDANCE_UPSERT` row (`"<n> marks"`) is kept. |
| Not logged | No passwords, tokens or secrets; no student names, admission numbers or other student data. |

**Transaction and failure behaviour:**
- Attendance rows and their audit rows are added to the **same SQLAlchemy session** and committed by the existing single `db.commit()`. If any audit insert fails, the commit raises, the request fails, and nothing from that request persists (no unaudited change).
- Validation and authorization still run for every student **before** any row or audit is written, so a rejected request (403/400) writes neither.
- Audit rows become visible only when the attendance change commits (same transaction).

**Audit visibility** (`backend/app/api/v1/endpoints/audit.py`): `GET /api/v1/audit-logs` (`audit.read`) now returns `details` for `student_attendance` events only if the reader **also** holds `attendance.read`; otherwise `details` is `null` and the event is still listed. In practice the admin tier sees the details. The Finance Head (`accounthead`) has `audit.read` but no `attendance.read`, so it sees the event without per-student details. Other entity types are unchanged. Teachers, parents and students still get 403.

**Tests** (`backend/tests/test_attendance_audit.py`, isolated in-memory DB; all writes through the API):

| # | Requirement | Test | Result |
|---|---|---|---|
| 1 | Creation logs initial values | `test_create_logs_initial_values`: one `ATTENDANCE_CREATED` row, entity id = record id, actor = teacher, `previous` null, all `new` values, `accessBasis: assignment`, no student name | PASS |
| 2 | Previous/new status | `test_update_records_previous_and_new_status_and_marker`: Present → Absent, `changed = [markedBy, status]` | PASS |
| 3 | Section / marker change | Same test (marker: teacher → principal) and `test_section_change_is_recorded` (section A → null) | PASS |
| 4 | Substitute updates | `test_substitute_updates_carry_the_same_detail_plus_the_duty`: create and update by a substitute carry the same fields plus `accessBasis: substitute_duty` and the duty id (campus clock patched) | PASS |
| 5 | Rejected updates leave no change event | `test_rejected_writes_leave_no_change_events`: out-of-scope (403), invalid status (400) and a mixed allowed/forbidden batch (403) add no audit rows and change no attendance | PASS |
| 6 | Audit failure does not leave an unaudited change | `test_audit_failure_rolls_back_the_attendance_change`: the attendance audit insert is forced to fail at commit (NOT NULL violation). Both an update and a new record roll back: status and marker unchanged, no new row, no audit row | PASS |
| 7 | Unauthorized write / audit read | `test_unauthorized_users_cannot_write_or_read_attendance_audit_details`: parent write 403, nothing written; teacher and parent `GET /audit-logs` 403; Finance Head sees attendance events with `details = null` but other details unchanged; admin sees details | PASS |
| 8 | Existing permissions and privacy | Focused run below, plus the full suite | PASS |
| 9 | Repeated updates | `test_repeated_updates_chain_before_and_after_values`: Present → Absent → Late → (identical, no event) → Present; each event's `previous` equals the prior event's `new`; one record id | PASS |

**Results:**

| Run | Passed | Failed | Skipped |
|---|---|---|---|
| `test_attendance_audit.py` | **8** | 0 | 0 |
| Focused: attendance audit, attendance, admin attendance, Phase 4, Phase 3A, Phase 2, Phase 1 privacy, phase0 and leave (both read `/audit-logs`), admissions | **112** | 0 | 0 |
| **Full backend suite** | **520** | **0** | **35** (the 34 PostgreSQL migration skips + the opt-in `test_migration_substitute_duties`) |
| Frontend build | not run: no frontend files changed in this task | — | — |

**Diff check:**
- Changed in this task: `backend/app/services/attendance.py` (+audit helpers, write loop), `backend/app/api/v1/endpoints/audit.py` (detail gating), and the new `backend/tests/test_attendance_audit.py`.
- No existing test or assertion was removed or weakened.
- **No schema change and no migration** in this task; `audit_logs.details` is an existing `TEXT` column. Only `0020` (Phase 4) is pending.

**Live state (verified read-only):** `alembic_version = 0019_admission_zip_widen`, no `substitute_duties` table, backend stopped (no uvicorn process, port 8000 not answering). Migration 0020 has **not** been run.

**Remaining limitations:**
- The audit rows record changes **through the API only**. Direct SQL edits to `student_attendance` would not be audited.
- Each change row stores `markedBy` as a user id; showing names needs a lookup at read time.
- There is no audit-viewing screen for attendance history; the data is available through `GET /api/v1/audit-logs` (admin tier).
- `GET /audit-logs` returns all campus rows with no paging (existing behaviour), and the per-mark rows increase its volume.

### 15.11 Final verification before migration 0020 (27 Oct 2026) — no service started, live DB not written

**1. Attendance-audit API**

| Check | Result | Evidence |
|---|---|---|
| Authorized readers see the details | **PASS** | `audit.read` is held only by superadmin, admin and managing_director (`_ADMIN`, every permission incl. `attendance.read`) and accounthead (`matrix.py:117-178`). Test: admin reads `ATTENDANCE_CREATED` details. |
| Finance Head sees attendance events without details | **PASS** | `DETAIL_PERMISSION = {"student_attendance": "attendance.read"}`; `accounthead` lacks it. Test asserts `details is None` for every `student_attendance` row (this includes the old `ATTENDANCE_UPSERT` summary). |
| Other event details unchanged | **PASS** | Other entity types fall back to `audit.read`, which the caller already holds. Test asserts the Finance Head still gets non-attendance details. |
| Teachers, parents, students cannot read the audit log | **PASS** for teacher and parent (test: 403). Student: **code-verified only**; the student role has no `audit.read` (`matrix.py:221-233`) and `require_permission` returns 403. No student-login test. | |
| No alternate endpoint leaks details | **PASS (code)** | `GET /api/v1/audit-logs` is the only reader of `audit_logs`. `audit_service.list_audit_logs` (legacy `system_audit_logs`) has no caller. `AuditMiddleware` is **not mounted** (`main.py` adds CORS only; `API_BACKLOG.md:42`) and would not store bodies anyway. Approval detail, notifications and other endpoints do not read `audit_logs`. |

**2. Migration 0020**

| Check | Result | Evidence |
|---|---|---|
| Creates only the intended objects | **PASS** | Recompiled the PostgreSQL DDL now: identical to §15.9 (table, PK, `ck_substitute_duty_window`, 6 FKs, `ix_substitute_duties_teacher_date`; no other table touched). `alembic heads` = `0020_substitute_duties (head)`. File timestamps 17:59, before the audit work. |
| Downgrade refuses a populated table | **PASS (code + SQLite)** | `drop_tables_if_empty` raises `MigrationAborted` when rows exist (§15.4, §15.9) |
| Audit change adds no schema or migration dependency | **PASS** | The audit work changed only `services/attendance.py`, `endpoints/audit.py` and a new test file. `models/attendance.py` and `models/audit.py` are unmodified. Live `audit_logs` columns already fit (read-only): `action varchar(64)`, `entity_type varchar(64)`, `entity_id varchar(64)` (record UUID = 36 chars), `details text`. |

**3. PostgreSQL execution of 0020 — NOT VERIFIED**

`TEST_PG_URL` is not set (process, user and machine environment, and not in `backend/.env`). The only configured account, `qmis_app`, has `rolcreatedb = false` and `rolsuper = false` (read-only check), so it cannot create a disposable database. The opt-in test also needs a superuser for its row insert. Using `qmis_erp` as a target is not allowed. The test was therefore **skipped**. To run it, a disposable-database account (e.g. the PostgreSQL superuser) must be supplied through `TEST_PG_URL` (§15.9 command).

**4. Test results (fresh run)**

| Run | Passed | Failed | Skipped |
|---|---|---|---|
| `tests/test_attendance_audit.py -v` | **8** (all named tests PASSED) | 0 | 0 |
| Full backend suite (`pytest tests -q -rs`) | **520** | **0** | **35** |

Skip reasons are PostgreSQL only:
- `test_migration_class_academic_year`, `test_migration_class_details` and `test_migration_hr_user_id` skip with "PostgreSQL not reachable … ProgrammingError" (their `CREATE DATABASE` as `qmis_app` is refused).
- `test_migration_substitute_duties` skips with "TEST_PG_URL not set".

After the run, read-only checks found no `qmis_test_*` database (only `qmis_erp` and the pre-existing `qmis_academic_browser`).

**§15.10 accuracy:** matches the implementation, with one clarification: "Teachers, parents and students still get 403" is tested for teachers and parents; for students it is code-verified only.

**Live state (read-only, after all runs):**
- `alembic_version = 0019_admission_zip_widen`
- `substitute_duties` **absent**
- backend **stopped** (0 uvicorn processes, no listener on port 8000)
- migration 0020 **not run**; nothing committed

**Open before applying 0020:**
- PostgreSQL execution of the migration (item 3)
- browser checks of the new screens (§15.6)

**Waiting for explicit approval.**

---

## 16. Database connection and stabilization — Phase 1 result (27 Oct 2026): STOPPED at the safety gate

Inspection and read-only checks only. No service was started, no migration was run, nothing was written to the database, and no secret value was printed.

| Area | Finding |
|---|---|
| PostgreSQL | Service `postgresql-x64-18` **running** (port 5432 listening). `postgresql-x64-17` is installed but stopped. |
| Connection | Via the backend's own engine: connected as `qmis_app` to `qmis_erp` (server 18.6); harmless read-only query **OK**. URL in `backend/.env`: `postgresql+psycopg://qmis_app:****@localhost:5432/qmis_erp`. |
| Revision | `alembic_version = 0019_admission_zip_widen`; `substitute_duties` **absent**; 54 public tables. |
| Live data | Real records present: users 77, students 29, admissions 33, hr_employees 43, ops_records 36, finance_records 1, front_office_records 13, academics_records 2, audit_logs 2,156. |
| Frontend ↔ backend config | Consistent. Root `.env`: `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`, `VITE_USE_API_AUTH/ADMISSIONS/FINANCE=true`. Backend `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`. Vite dev server listening on 5173; backend on 8000 **stopped**. |
| Startup side effects | `main.init_db()` runs on every start: `Base.metadata.create_all()` (would **create `substitute_duties`** now that the model exists), the `ensure_hr/admissions/masters/exams` schema helpers (idempotent ALTERs), and `seed_reference_data()` (demo users, roles/permissions, reference rows). Starting the backend against `qmis_erp` is therefore a schema change. |
| Integrations | `backend/.env` has `INTEGRATIONS_MODE=live` with SMTP and WhatsApp settings present. UI workflows that notify (approvals, leave, announcements, TC, etc.) could send **real** messages during testing. |
| Backups | `C:\karan\erp-db-backups\` holds 4 dumps from **14 Oct 2026** (newest `qmis_erp_before_0007_20261014_170016.dump`, readable by `pg_restore --list`, but it predates `ops_records`/`academics_records`, i.e. revisions 0013–0014). **No backup of the current (0019) state exists.** |
| PostgreSQL migration test | Still not executable: no `TEST_PG_URL`, and `qmis_app` has neither CREATEDB nor superuser (§15.11). |

**Why stopped:** Phase 2 (frontend → API → database) and Phase 4 (end-to-end module checks) need a running backend against `qmis_erp`. Starting it creates `substitute_duties` (an unapproved schema change), and no valid current backup exists. Live integrations could also send real messages.

**Needed to continue (your decisions):**
1. **Backup:** take and verify a fresh dump of `qmis_erp` at 0019. For example, from `C:\karan\QMIS\backend`:
   `& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h localhost -p 5432 -U qmis_app -Fc -f C:\karan\erp-db-backups\qmis_erp_before_0020_<timestamp>.dump qmis_erp`
   (password entered at the prompt), then `pg_restore --list` on the new file.
2. **Migration 0020:** approve applying it (plan in §15.9: `alembic current` → `alembic upgrade 0020_substitute_duties` → `alembic current`), optionally after the opt-in PostgreSQL test with a privileged disposable-database account. The alternative is to keep 0020 unapplied, which would need a code change so startup does not run `create_all` for that table (proposal only).
3. **Integrations during testing:** confirm whether UI testing may run with `INTEGRATIONS_MODE=live`, or set it to the existing stub/demo mode for the test session.
4. **Test data on the live DB:** confirm whether isolated, clearly labelled test records may be created in `qmis_erp` for Phase 4 persistence checks, or whether Phase 4 should use the isolated test database plus read-only live checks only.

**Update, 27 Oct 2026, 19:00 — run for a client demo (user request):**
1. **Backup** `C:\karan\erp-db-backups\qmis_erp_before_0020_20261027_185916.dump` (361 KB). `pg_restore --list`: dbname `qmis_erp`, 352 entries, table data present for `alembic_version`, `users`, `students`, `admissions`, `ops_records`, `academics_records` and `audit_logs`.
2. **Migration** `alembic upgrade 0020_substitute_duties`: `0019_admission_zip_widen` → `0020_substitute_duties (head)`. Read-only check afterwards: 55 tables (54 + `substitute_duties`), and all checked row counts unchanged (users 77, students 29, admissions 33, hr_employees 43, ops_records 36, front_office_records 13, academics_records 2, audit_logs 2,156).
3. **Backend** started (`uvicorn --reload`, port 8000). `/health` OK; admin, principal and teacher demo logins return 200 with the correct roles; CORS preflight from `:5173` allowed; frontend on `:5173` answering.
4. `INTEGRATIONS_MODE` left as configured (`live`); the stub switch was agreed for the testing session only.
5. Phase 2–6 module stabilization is **not** started yet.
