# QMIS ERP — Audit: Dynamic Class/Section Masters & Staff Leave / Hourly Permission

| Field | Value |
|---|---|
| **Date** | 29 October 2026 |
| **Status** | **Audit only — implementation deferred** where values/policies are ambiguous |
| **Scope** | Read-only inspection of current codebase; no commit / push / deploy / production migration |
| **Environment note** | Does not change the active academic UAT (`:5173` → `:8000`) |

---

## Executive verdict

| Module | Verdict |
|---|---|
| **1. Class / section masters** | Backend already supports per-year **classes** and free-text **section names** with Admin CRUD, activate/deactivate, uniqueness. Many frontend screens still use hardcoded `A/B/C`. Required list **A, B, C, A1, A2, AEP, NA** is **not** fully evidenced as section labels in code/docs — **stop seeding those names until partner confirms meaning**. |
| **2. Leave & hourly permission** | Backend already implements leave types, **Permission ≤ 2h**, **Casual+Personal ≤ 2 days/month** (pending+approved), multi-month split, overlap rules, dept-head→HR approval, and tests. Gaps remain (half-day, start/end time, attachments, cancel/withdraw, configurable policy table, permission–permission overlap, FE balance UX). Do **not** invent half-day / holiday / conversion rules. |

**Next step:** Partner confirmation on Module 1 value meanings and any Module 2 policy gaps marked “unresolved”. Then implement focused deltas only.

---

## Module 1 — Dynamic class and section management

### 1.1 Current data model (canonical)

Live ORM package: `backend/app/models/academics.py` (exported from `app.models`).

| Entity | Table | Key fields | Notes |
|---|---|---|---|
| Academic year | `academic_years` | `name`, `is_current`, `is_active`, campus | Unique `(campus_id, name)` |
| Class | `school_classes` | `academic_year_id`, `name`, `is_active` | Unique `(campus, academic_year, name)`. Optional legacy `section` column on class row (nullable) |
| Section | `sections` | `class_id`, `name`, `is_active`, `capacity`, `room_number`, `class_teacher_user_id` | Unique `(campus, class_id, name)`. **Name is free text** (String 20), not an enum |
| Subject | `subjects` | `code`, `name` | Separate master |

**Placement / timetable / exams / allocations** commonly store **class name + section name strings** and/or FKs to `sections.id` / `school_classes.id` depending on module (placement uses `section_id`; exams often store display labels in JSON/`class_name`/`section`).

Legacy integer models still exist in `backend/app/models/masters.py` and are imported by `masters_service.py` / `db.base` — **risk of dual definitions**. Live API `masters.py` uses `app.models` (UUID academics). Treat `masters_service.DEFAULT_*` as seed helpers only.

### 1.2 Current API / Admin workflow

| Capability | Status | Location |
|---|---|---|
| List/create/patch/deactivate classes | **Exists** | `GET/POST/PATCH/DELETE /api/v1/masters/classes…` |
| List/create/patch/deactivate sections | **Exists** | `GET/POST/PATCH/DELETE /api/v1/masters/sections…` |
| Class teacher picker | **Exists** | `GET /masters/class-teacher-options` |
| Admin UI | **Exists** | `src/Pages/Admin/Class/ClassDetails/*` — add class, edit/add sections, deactivate, academic year scoped |
| Server uniqueness | **Exists** | DB unique + API 409 on duplicate section name under class |
| Server “allowed section vocabulary” | **Missing** | Any non-empty string ≤20 chars can be a section name; no campus-wide catalog of allowed labels |
| Reject inactive combination on all write paths | **Partial** | Masters list can hide inactive; not every consumer (exams/marks/placement/timetable) re-validates against active masters |

Default seeds:

- `masters_service.DEFAULT_SECTIONS = ["A", "B"]` (only when zero subjects/classes seeded)
- `placement.py` `_DEFAULT_SECTIONS = ("A", "B", "C")` when auto-creating sections

### 1.3 Frontend hardcoding (non-exhaustive but material)

| Path | Hardcoded values |
|---|---|
| `src/Pages/Principal/ExaminationTimetable/examinationTimetableData.js` | `SECTIONS = ['A','B','C']` |
| `src/Pages/Teacher/CreateExamSchedule/…/ExamScheduleForm.jsx` | Fallback `SECTIONS` |
| `src/Pages/Principal/ClassTimetable/classTimetableData.js` | `['A','B','C','D']` |
| `src/Pages/Principal/TeacherAllocation/teacherAllocationData.js` | `FALLBACK_SECTIONS = ['A','B','C']` |
| `src/Pages/Teacher/OnlineClass/onlineClassData.js` | Same fallback |
| `src/Pages/FrontOffice/StudentReEnrollment/…` | `SECTIONS = ['A','B','C']` |
| `src/Pages/Coordinator/Attendance*/…` | Classes `9/10`, sections `A/B` (demo-shaped) |
| `src/Pages/Admin/Class/ClassDetails/classDetailsOptions.js` | **Class** labels Pre-KG…Grade 12 (not sections) |
| Mark Entry | Sections from API when class details API works; otherwise hardcoded `SECTIONS` |

**Gap:** Dropdowns/filters are not consistently driven from `/masters/sections` (or class directory). API-mode Class Details is the intended SoT, but many modules still fall back to local arrays.

### 1.4 Required values A / B / C / A1 / A2 / AEP / NA — evidence check

| Value | Found as academic class/section? | Other meanings in repo |
|---|---|---|
| **A, B, C** | Yes — default / fallback **section names** under a grade | — |
| **A1, A2** | **No** academic section/class usage found | Appear as **approval step labels** (A1/A2/A3) in module access matrices |
| **AEP** | **No** occurrence as class/section master | — |
| **NA** | **No** as academic section master | Used as **“not applicable”** placeholder in Quality Auditor observation forms / star ratings |

**Ambiguity (STOP before inventing rows):**

1. Are A1 / A2 / AEP / NA **section names** under every Grade (e.g. Grade 6-AEP)?  
2. Or **special programme / stream / class-level** names (siblings of “Grade 6”)?  
3. Or **non-academic categories** (e.g. transport/hostel “NA”)?  
4. Should “NA” be selectable for placement, or only for forms that mean “not applicable”?

Until the partner confirms, **do not** bulk-insert A1/A2/AEP/NA into `sections` or `school_classes`.

### 1.5 Gaps vs Module 1 requirements

| Requirement | Current | Gap |
|---|---|---|
| Configurable via authorized admin | Partial — Class Details already CRUD | No campus-wide “allowed section vocabulary”; class level list still FE-hardcoded in places |
| Add/edit/activate/deactivate/select | Partial | Present for sections/classes; not all consumers refresh from API |
| Dropdowns from backend | Partial | Class Details + some Mark Entry paths; many hardcoded fallbacks |
| Server validate combinations | Partial | Uniqueness yes; inactive rejection inconsistent across exams/marks/timetable |
| Preserve historical data | Design already year-scoped + soft deactivate | Must not rename/delete; deactivate only |
| Canonical identifiers + academic year | Partial | FKs exist; string labels still used in exams/timetable JSON |

### 1.6 Recommended implementation plan (after clarification only)

1. Confirm taxonomy of A1/A2/AEP/NA with partner (section vs class vs other).  
2. If they are **section names**: Admin creates them under the relevant classes via existing Class Details (no migration required for free-text names); optionally add a campus **section-label catalog** only if product wants a closed vocabulary.  
3. Wire remaining FE dropdowns to class directory / `listSectionNamesForClassApi` / masters; remove silent hardcoded fallbacks in API mode.  
4. Add server-side “class+section must be active for academic year” checks on placement, marks, timetable, exam schedule writes.  
5. Tests: section CRUD, duplicate 409, inactive rejected, historical placement FK still resolves after deactivate (not delete).

---

## Module 2 — Staff leave and hourly permission

### 2.1 What already exists (reuse, do not reinvent)

| Area | Evidence |
|---|---|
| Model | `LeaveRequest` — `leave_type`, `from_date`, `to_date`, `total_days`, `hours` (Permission), `approval_id` (`backend/app/models/leave.py`) |
| Service rules | `backend/app/services/leave.py` docstring + constants |
| API | `POST/GET /api/v1/leave-requests`, `…/decide`, `…/on-leave` (`leave.write` / `leave.read` / `leave.decide`) |
| Approval | Entity `leave_request`; chain via `DEPT_HEAD` then HR; mirrors FE `leaveRequestConfigs.js` |
| FE | `src/Common/LeaveRequest/*` + role pages; HR `LeaveManagement.jsx` (local policy table UI) |
| Tests | `backend/tests/test_leave.py` — chain, permission hours, overlap, access, **2-day monthly cap**, multi-month span, denied frees days |

### 2.2 Policy rules found in code (not invented)

Quoted from `backend/app/services/leave.py`:

1. **Permission** = short absence **≤ 2.0 hours**, **single calendar day**; attendance status `Permission`.  
2. **Casual Leave + Personal Leave** together **≤ 2 days per calendar month**; **pending and approved** count; **denied** does not.  
3. **Sick / Medical / Emergency** are **not** under that monthly cap.  
4. **Week-Off** is a leave type string in `LEAVE_TYPES`.  
5. **Overlap**: any non-denied request overlapping dates fails **409**, except Permission vs Permission is currently **skipped** (permissions do not block each other).  
6. **No edit / no delete / no cancel** once filed (doc immutability).  
7. **Self-approval**: decide uses approval engine + role chain; requester is not in own decide path for normal roles (teacher cannot decide).  
8. Leave types are a **hardcoded** Python list — not a DB policy table.

### 2.3 Gaps vs Module 2 requirements

| Requirement | Status | Notes |
|---|---|---|
| Leave form: type from configured policies | **Gap** | Types hardcoded; HR UI has local “policies” not wired as SoT |
| Full-day / half-day | **Unresolved / missing** | No half-day field; `total_days` is inclusive date count (integer) |
| Attachment | **Missing** | No attachment column/endpoint on leave |
| Available balance / monthly usage UX | **Partial** | Cap enforced on create; no dedicated balance API/summary for staff UI |
| Max 2 days/month backend | **Done** | Casual+Personal only — **preserve** |
| Multi-month calculation | **Done** | `_days_by_month` + tests |
| Duplicate / overlap | **Partial** | Date overlap yes; Permission–Permission overlap **not** blocked |
| Half-day / weekend / holiday effects | **Unresolved** | No holiday calendar integration in leave service; weekends count as days today |
| Hourly permission option | **Done (basic)** | Type `Permission` + `hours` ≤ 2 |
| Date + start/end time | **Gap** | Only `hours` float; no start/end timestamps |
| Duration within policy | **Done** for max hours |
| Permission vs leave conflict | **Partial** | Leave blocks permission on same dates; two permissions same day allowed |
| Separate permission-hour allowance | **Not defined** | No monthly permission-hour budget in code — **do not invent** |
| Configurable limits | **Gap** | Constants in service; not Admin-configurable |
| Approval workflow reuse | **Done** | |
| Ownership / role checks | **Done** (with tests) | |
| Cancel / withdraw | **Explicitly absent** | Matches current immutability rule — changing needs policy OK |
| History / filters / HR reporting | **Partial** | List boxes + HR bridge; deepen reporting if required |

### 2.4 Unresolved policy questions (stop inventing)

1. Do **half-days** exist? How do they count toward the 2-day monthly cap (0.5)?  
2. Do **weekends / holidays** count toward leave days?  
3. Is **Permission** allowed on a day that also has half-day leave?  
4. Should two **Permission** windows on the same day be forbidden / capped (e.g. total ≤ 2h)?  
5. Is there a **monthly permission-hour allowance**, or only the per-request 2h max?  
6. May staff **cancel/withdraw** pending requests, contrary to current immutability?  
7. Should leave types / caps be **Admin-configurable**, or remain school-fixed constants?  
8. HR LeaveManagement “entitlement 12 / maxConsecutive” — is that real policy or demo UI only?

### 2.5 Recommended implementation plan (after clarification)

**Safe now (no policy invent):** FE polish to surface existing API balances/caps; ensure Permission UI captures hours; harden Permission overlap if product confirms; remove fake local policy numbers when API mode is on.

**Needs confirmation:** half-day schema, start/end time, attachments, cancel, configurable policy table, permission-hour monthly budget, weekend/holiday rules.

**Preserve:** `MAX_CAPPED_DAYS_PER_MONTH = 2` for Casual+Personal unless an authorized policy configuration replaces it.

---

## Cross-cutting risks

1. **Dual masters model files** (`models/masters.py` vs `models/academics.py`) — confuse seed/migration authors.  
2. **String vs FK** for class/section across exams/timetable — renaming display labels without FKs can orphan UI filters (deactivate > rename).  
3. **Connection-slot / pgAdmin** environment risk (separate academic UAT) can cause intermittent API failures during browser tests.  
4. Inventing AEP/NA as sections could pollute placement/attendance for every grade.

---

## Affected files (primary)

### Module 1
- `backend/app/models/academics.py`, `backend/app/api/v1/endpoints/masters.py`, `backend/app/services/masters_service.py`, `backend/app/services/placement.py`
- `src/Pages/Admin/Class/ClassDetails/*`, `src/services/classDetailsApi.js`, `src/services/examsApi.js` (`listSectionNamesForClassApi`)
- Hardcoded section arrays listed in §1.3

### Module 2
- `backend/app/models/leave.py`, `backend/app/services/leave.py`, `backend/app/api/v1/endpoints/leave.py`, `backend/tests/test_leave.py`
- `src/Common/LeaveRequest/*`, `src/services/leaveApi.js`, `src/Pages/HR/LeaveManagement/*`
- Approvals: `backend/app/services/approvals.py` (`leave_request`)

---

## What this audit deliberately does **not** do

- Does not seed A1/A2/AEP/NA.  
- Does not change leave caps, half-day semantics, or holiday rules.  
- Does not commit, push, deploy, or run production migrations.  
- Does not claim browser UAT for these modules (not performed in this pass).

---

## Sign-off gate for implementation

Implementation may proceed only after partner answers:

1. Exact taxonomy of **A / B / C / A1 / A2 / AEP / NA** (section vs class vs other).  
2. Leave: half-day, weekend/holiday counting, permission overlap/budget, cancel/withdraw, configurability.

Until then, status remains: **Audit complete — Module 1 vocabulary and Module 2 policy gaps blocked pending verification.**
