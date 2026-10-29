# QMIS ERP — End-to-End Admission, Examination, Marks and Results Workflow Audit

| Field | Value |
|---|---|
| **Product** | Queen Mira International School (QMIS) ERP |
| **Document** | End-to-end academic examination & results audit |
| **Date** | 29 October 2026 |
| **Mode** | Read-only codebase audit (no code changes, no live DB writes, no real notifications) |
| **Evidence** | Frontend routes/screens, backend APIs/services/models, permission matrix, Alembic migrations, automated test sources; prior isolated pytest evidence where noted |
| **Related docs** | `docs/QMIS_Academic_Workflow_User_Manual.md` (operational manual; this document is the gap audit) |

### Evidence labels

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed in source (and/or named automated tests). |
| **UNVERIFIED** | Not proven by this audit (no live browser UAT / no fresh pytest run for that claim). |
| **GAP** | Expected school workflow differs from, or is incomplete in, the implemented product. |

---

## 1. Actual implemented workflow

```text
Enquiry (Active)
  → convert → Admission (Active); Enquiry → Success
  → enroll  → Student (placement_status=pending, academic_year_id if current AY exists,
               class_name canonicalized); optional Parent/Student users; Admission → Enrolled
  → place   → Student (class_id, section_id, section, roll_number, placement_status=placed)
  → create Exam (class_name + optional schedule JSON) → draft
  → submit exam_timetable → Director only
  → Director approve → Exam status approved  [required before marks]
  → Teacher/Coordinator MarksBatch draft → submit marks_batch
  → Coordinator → Principal → Director approve
  → final Director approve = published results
  → Parent/Student GET results (published only) + Parent in-app Notification (result_published)
  → optional API marks_correction (Principal → Director); original published kept until correction approved
```

**Key product facts (VERIFIED):**

- There is **no separate “admission approval”** FSM. PRM/Admin with `admissions.write` convert and enroll.
- Exam timetable approval is **Director-only** (`exam_timetable` chain `["director"]`). Principal/Coordinator submit; they do **not** approve the exam.
- Marks “publication” is **not** a separate entity: final `marks_batch` approval status `approved` is surfaced as API status **`published`**.
- Parent notification on publish is **in-app only** (no email/WhatsApp for `result_published`).
- Letter grades / pass mark (33%) are **frontend-only** (`gradeRules.js`); server stores marks and computes totals/%/ranks/weightage.

---

## 2. Expected workflow (requested)

Enquiry → Admission → Enrolment → Section Placement → Create Examination → Director Approval → Marks Entry → Coordinator Review → Principal Approval → Director Publishes Results → Parent/Student View Results → Parent Notification.

---

## 3. Stage-by-stage comparison

| # | Expected stage | Actual implementation | Match | Evidence |
|---|---|---|---|---|
| 1 | Enquiry | Admin/FO enquiry CRUD; statuses Active / Success / In Active | **Mostly match** | Routes under `/admin|front-office/…/admission-enquiry`; API `/admissions/enquiries*` (`admissions.write`) |
| 2 | Admission | Convert enquiry **or** direct create; status Active → Enrolled | **Partial** | No Director/Principal “admission approval” step (**GAP** vs some school SOPs that expect one) |
| 3 | Enrolment | `POST /admissions/{id}/enroll` creates `Student` + optional portal users; links `admission_id` / `enquiry_id` | **Match** | `admissions.enroll_admission`; tests in `test_admissions.py` |
| 4 | Section Placement | Coord/Principal UI + `POST /students/{id}/place` (`students.place`); grade-band for coordinators | **Match** (with notes) | Placement persists FKs + roll; student portal gated until `placed`. Marks path does **not** require `placed` (**GAP**) |
| 5 | Create Examination | Principal (and Coordinator with `exams.write`) create `Exam` + optional `schedule` | **Match** | Teacher UI exists but teacher lacks `exams.write` → API 403 when auth on (**GAP**) |
| 6 | Director Approval (exam) | `exam_timetable` → Director decide | **Match** | No Principal exam-approve step (by design) |
| 7 | Marks Entry | Batch per exam/subject/section; blocked until exam approved | **Match** | `create_batch` 409 if exam not approved; absent/range/duplicate rules present |
| 8 | Coordinator Review | First `marks_batch` step; skipped if coordinator submitted own batch | **Match** | `ACADEMIC_CHAIN`; grade-band visibility |
| 9 | Principal Approval | Second marks step | **Match** | Shared Mark Entry Approval screens |
| 10 | Director Publishes | Final marks approve = publish | **Match** | No separate “Publish” button/entity |
| 11 | Parent/Student View | `GET /results/students/{id}`; published only; own-child / self scope | **Match** | Portal routes via `StudentPortalRoutes` (`…/exam-result`, `…/exam-schedule`) |
| 12 | Parent Notification | In-app on final marks approve; parent only; idempotent | **Partial** | Email/WhatsApp **not** wired for results (**GAP** vs expected external notify) |

---

## 4. Confirmed gaps and root causes

| Priority | Gap | Root cause | Impact |
|---|---|---|---|
| P0 | Local Postgres historically missing `exams.schedule` caused `GET /marks-batches` HTTP 500 | Migration `0022_exam_schedule_json` existed but was not applied on stuck `0021` DBs | Mark Entry list fails until `alembic upgrade` applied. **Local `qmis_erp` fixed 29 Oct 2026**; other environments **UNVERIFIED** |
| P1 | Expected “admission approval” not implemented | Product uses Active→Enroll with `admissions.write` only | SOP mismatch if school requires Principal/Director admit sign-off |
| P1 | Marks/results join primarily on **string `class_name`**; placement not required for mark entry | `_apply_entries` checks campus + `stu.class_name == exam.class_name` only | Unplaced students can appear in mark entry; section filter on FE is loose for empty section |
| P1 | Parent “notification” is in-app only | `notify_parents_result_published` writes `Notification` rows; no call to `integrations.notify` email/WhatsApp | Parents without in-app login miss alerts; WhatsApp Business remains unused for results |
| P2 | Notify failure can roll back publish | `notify_parents_result_published` runs inside same `db.commit()` as `approvals.decide` | DB insert failure on notification would abort approval (no outbox/retry) |
| P2 | Marks correction API exists; Teacher UI not wired | `requestMarksCorrectionApi` in `examsApi.js` unused by Mark Entry screens | Corrections only via API/tests unless staff use raw API |
| P2 | Letter grade / pass-fail only on frontend | No server grading config table | Different clients could diverge; server never returns letter grade |
| P2 | Teacher Create Exam Schedule UI vs missing `exams.write` | Permission matrix omits teacher from `exams.write` | Confusing 403 when API mode on |
| P3 | Director has `students.place` but no placement UI | Director routes redirect old allocation paths to dashboard | Must use Principal/Coordinator UI |
| P3 | Dual SoT if `VITE_USE_API_ADMISSIONS=false` / exams API off | LocalStorage paths remain in FE data modules | Demo mode can diverge from server truth |
| P3 | `Exam.academic_year` is a display string, not FK to `AcademicYear` | Model design | Year mismatch risk vs `Student.academic_year_id` |
| P3 | Leftover `exams.slots` column on some Postgres DBs | Pre-`schedule` schema remnant; ORM ignores it | Noise only if ops confuse columns |
| P3 | Remarks on `MarkEntry` not returned in published `_exam_table` subject payload | Result DTO omits remarks | Portal shows “—” for remarks |
| P3 | Weightage lock uses exam `start_date <= today`, not approval status | `set_weightage` / `_weights_out` | Draft past-dated exams can lock weightage |

---

## 5. API, model, and permission relationships

### 5.1 Core models

| Model | Table | Role in pipeline |
|---|---|---|
| `AdmissionEnquiry` | `admission_enquiries` | Lead; convert sets `converted_admission_id` |
| `Admission` | `admissions` | Application; `enrolled_student_id` after enroll |
| `Student` | `students` | Academic identity; `placement_status`; portal FKs |
| `Exam` / `ExamType` / `ExamWeightage` | `exams*` | Class exam + schedule JSON + weights |
| `MarksBatch` / `MarkEntry` | `marks_batches`, `mark_entries` | Subject marks; unique student per batch |
| `ApprovalRequest` / `ApprovalEvent` | approval tables | Append-only FSM + audit events |
| `Notification` | notifications | In-app inbox including `result_published` |

### 5.2 Status mapping

| Domain | DB / approval | API-facing status |
|---|---|---|
| Enquiry | Active / Success / In Active | same strings |
| Admission | Active / Enrolled / In Active | same |
| Student placement | pending / placed | `placementStatus` |
| Exam | approval None / pending / approved / denied | draft / submitted / **approved** / denied |
| Marks batch | approval None / pending / approved / denied | draft / submitted / **published** / denied |

### 5.3 Approval chains (`backend/app/services/approvals.py`)

| `entity_type` | Submit roles | Chain |
|---|---|---|
| `exam_timetable` | principal, coordinator | director |
| `marks_batch` | teacher, coordinator | coordinator → principal → director |
| `marks_correction` | teacher, coordinator | principal → director |

Decide rules (VERIFIED): awaiting role only; cannot decide own/owner submission; deny requires comment; `ApprovalEvent` + `write_audit` on transitions.

### 5.4 Permission codes (workflow-critical)

| Permission | Typical roles | Used for |
|---|---|---|
| `admissions.write` | prm, pro, admin family | Enquiry, admission, enroll |
| `students.place` | coordinator, principal, director (+ admin) | Place + coordinator grade bands |
| `students.promote` | same | Promote |
| `exams.write` | principal, coordinator (+ admin) | Create/submit exam |
| `exams.configure` | director (+ admin) | Types / weightage |
| `exams.read` | academic staff + parent/student | List schedules / staff results table |
| `marks.write` / `marks.read` | teacher, coordinator, principal, director… | Mark entry & review lists |
| `results.read` | staff + parent/student | Published student results |
| `approvals.decide` | chain roles | Approve / deny |

### 5.5 Primary API surface

| Stage | Methods |
|---|---|
| Enquiry / admission | `/api/v1/admissions/enquiries*`, `/api/v1/admissions*`, `…/enroll` |
| Placement | `/api/v1/students/pending-placement`, `…/{id}/place`, `…/promote`, grade-bands |
| Exams | `/api/v1/exams`, `…/submit`, `/exam-types`, `/exam-weightage` |
| Marks | `/api/v1/marks-batches`, `…/entries`, `…/submit`, `…/revise`, `…/request-correction` |
| Approvals | `/api/v1/approvals/inbox`, `…/{id}/decide`, history |
| Results | `/api/v1/results/students/{id}`, `/api/v1/exams/{id}/results` (staff) |
| Notifications | `/api/v1/notifications` (+ read markers) |

### 5.6 Frontend route map (API mode)

| Role | Screens |
|---|---|
| Admin / PRM | Admission enquiry + admission list enroll |
| Coordinator | `/coordinator/student-placement*`, mark entry + mark-entry-approval |
| Principal | `/principal/examination-timetable*`, mark-entry-approval, student-allocation-approval |
| Director | Exam approvals, `/director/mark-entry-approval*` |
| Teacher | `/teacher/student-evaluation/mark-entry` |
| Student / Parent | `…/student-evaluation/exam-schedule`, `…/exam-result` (parent uses same portal routes with prefix) |

---

## 6. Existing test results and missing regression tests

### 6.1 Automated coverage (source inventory — VERIFIED present)

| Area | Test modules |
|---|---|
| Enquiry → enroll | `tests/test_admissions.py` |
| Placement / promotion (used heavily as fixtures) | `test_promotion_guard_phase5.py`, `test_results_after_promotion.py`, access suites |
| Exam + marks publish + parent visibility | `test_exams.py`, `test_results_phase3.py` |
| Mark entry draft/lock/revise | `test_mark_entry_phase1.py` |
| Approval screens / role gates | `test_approval_screens_phase2.py`, `test_approvals.py` |
| Coordinator band scoping | `test_academic_access_phase2.py`, `phase3a` |
| Marks correction | `test_marks_correction_phase6.py` |
| Parent in-app result notify | `test_result_notifications_phase7.py` |
| Results after promotion | `test_results_after_promotion.py` |

### 6.2 Recent execution evidence (this environment)

| Run | Result | Notes |
|---|---|---|
| Mark-entry related suites (29 Oct 2026, `--import-mode=importlib`) | **16 passed** | `test_mark_entry_phase1`, `test_approval_screens_phase2`, `test_results_phase3`, `test_marks_correction_phase6` |
| Full `pytest tests/` (same day) | **644 passed, 9 failed, 35 skipped** | Failures **not** schedule/marks-pipeline core (attendance session shape, Razorpay config, frontend static expectations) |
| Live local Postgres `:8000` after `0022` | `GET /marks-batches` **200** | Schema fix verified; **not** a full browser UAT |
| Browser UAT full path this audit | **UNVERIFIED** | Not re-executed in this pass |

### 6.3 Missing / weak regression tests (recommended)

| Missing test | Why |
|---|---|
| `exams.schedule` / timelines round-trip on create + update | Migration exists; no dedicated API assert found |
| Mark entry **rejects** (or explicitly allows) `placement_status=pending` | Documents product rule once decided |
| Notify failure isolation (approve succeeds if Notification insert fails) | Currently coupled in one transaction |
| Email/WhatsApp result event (mocked) | Only if product adds external notify |
| Teacher UI cannot call create-exam without `exams.write` (static or API) | Prevents UI/permission drift |
| FE marks-correction screen calls `requestMarksCorrectionApi` | Currently API-only |
| Admission “approval” workflow | N/A until product adds it |

---

## 7. Browser UAT checklist (per role)

Use an **isolated** API DB only. Do not use production data. Mark each row Pass / Fail / Blocked.

### 7.1 PRM / Admin — Enquiry → Enrol

| # | Step | Expected |
|---|---|---|
| A1 | Create enquiry | Appears in list; status Active |
| A2 | Convert enquiry | Admission created; enquiry Success |
| A3 | Complete parent email (+ optional student login per junior/senior rules) | Saved on admission |
| A4 | Enroll | Student created; admission Enrolled; student pending placement |
| A5 | Refresh Student Database | Same student; no duplicate enroll |
| A6 | Unauthorized role (e.g. Teacher) | Cannot create enquiry / enroll |

### 7.2 Coordinator / Principal — Placement

| # | Step | Expected |
|---|---|---|
| P1 | Pending placement list shows enrolled student | Visible in band (coord) / any (principal) |
| P2 | Place into section | Section + roll persist after refresh |
| P3 | Out-of-band coordinator | 403 / not listed |
| P4 | Student portal before place | Placement notice; schedule/results gated as designed |
| P5 | After place | Portal class/section correct |

### 7.3 Principal — Create & submit exam

| # | Step | Expected |
|---|---|---|
| E1 | Create timetable with subject timelines | Saved; schedule visible on edit |
| E2 | Submit for approval | Status submitted; Director inbox |
| E3 | Teacher tries create via official API path | 403 without `exams.write` |
| E4 | Marks entry before Director approve | Blocked (UI + API 409) |

### 7.4 Director — Exam approval

| # | Step | Expected |
|---|---|---|
| D1 | Approve exam | Status approved; appears on parent/student schedule for that class |
| D2 | Deny with reason | Denied; resubmit after edit |
| D3 | Non-Director approve attempt | Forbidden |

### 7.5 Teacher — Marks entry

| # | Step | Expected |
|---|---|---|
| M1 | Open Mark Entry for approved exam | Students for class/section load |
| M2 | Save draft; reload | Marks/absent preserved with exam/class/section |
| M3 | Validation | Missing marks rejected unless absent; out-of-range rejected |
| M4 | Submit | Locked; awaiting Coordinator |
| M5 | Duplicate batch same subject/section | Conflict unless prior denied |

### 7.6 Coordinator → Principal → Director — Marks approval

| # | Step | Expected |
|---|---|---|
| R1 | Coordinator approve | Moves to Principal; parent still sees no result |
| R2 | Principal approve | Moves to Director; still unpublished |
| R3 | Director approve | Status published; parent/student results appear |
| R4 | Wrong role at a step | Forbidden |
| R5 | Deny with reason | Teacher can revise new version |
| R6 | History / audit | Approval events visible to owner & approvers |

### 7.7 Parent / Student — Results & notification

| # | Step | Expected |
|---|---|---|
| V1 | Before publish | No result rows for that exam |
| V2 | After publish | Own marks, totals, %; FE grade/pass display |
| V3 | Other child / other student | 404 / empty — no cross leak |
| V4 | Refresh / re-login | Same published data only |
| V5 | Parent inbox | One “Result published” notice; not for siblings without marks |
| V6 | External email/WhatsApp | **Expect none today** unless product later adds it |

### 7.8 Correction (optional / API-heavy)

| # | Step | Expected |
|---|---|---|
| C1 | Request correction via API | New version; Principal→Director |
| C2 | Until correction approved | Parents still see prior published marks |
| C3 | After correction approved | Newer marks; history retained |
| C4 | Teacher UI correction | **Likely missing** — record Blocked if no screen |

---

## 8. Prioritized, minimal fix plan

Do **not** implement until this audit is approved. Smallest set that restores SOP trust:

### P0 — Schema hygiene (ops)

1. Ensure every environment that serves Mark Entry has applied Alembic through at least `0022_exam_schedule_json` (prefer `head`).
2. Add a startup or deploy check that fails fast if `exams.schedule` is missing (optional guard).
3. Add one API test: create exam with timelines → GET returns same `schedule`.

### P1 — Product decisions (pick one, then code)

1. **Admission approval:** either document “no separate approval” as intentional, or add a thin approval step before enroll.
2. **Placement gate for marks:** require `placement_status=placed` (and preferably section match) in `create_batch` / `_apply_entries`, **or** document that class_name-only is intentional.
3. **Parent notification channel:** keep in-app only (document), **or** add mocked email/WhatsApp event on publish with delivery status that **cannot** roll back approve (outbox / post-commit).

### P2 — UI / API parity

1. Wire Teacher Mark Entry (or Principal) to `requestMarksCorrectionApi`, or hide the capability until UI exists.
2. Remove or disable Teacher “Create Exam Schedule” when `exams.write` is absent.
3. Optionally return letter grade / pass from server **or** document FE-only grading as SoT.

### P3 — Cleanup (later)

1. Director placement UI or remove unused `students.place` expectation for Director.
2. Drop or migrate leftover `exams.slots` if still present.
3. Include `remarks` in published result subject DTO if required by UAT.
4. Align weightage lock with approved exams if trainers find start-date lock confusing.

---

## 9. Audit conclusion

The **core path is implemented end-to-end** in React + FastAPI: enquiry → enroll → place → exam (Director approve) → marks (Coordinator → Principal → Director publish) → parent/student published results → parent **in-app** notification. Automated tests cover most transitions; Mark Entry suites recently passed in this environment.

Main mismatches vs the stated school expectation are: **no separate admission approval**, **marks not strictly tied to placement**, **no email/WhatsApp result delivery**, **marks-correction UI missing**, and **environment-dependent `exams.schedule` migration application**.

**No code was modified for this audit.** Awaiting approval before any fixes.
