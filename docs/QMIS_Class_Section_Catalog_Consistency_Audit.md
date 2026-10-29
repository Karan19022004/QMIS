# QMIS ERP — Global Class/Section Catalog Consistency Audit

| Field | Value |
|---|---|
| **Date** | 29 October 2026 |
| **Canonical SoT** | Admin Class Details → `GET/POST/PATCH /api/v1/masters/classes|sections` → browser mirror `academicsCatalogData` (`mirrorApiClassDetails`) |
| **Environment** | Vite `:5173` → API `:8000` / Postgres `qmis_erp`; `:8001` untouched |
| **Phase** | Inventory → gap fixes → verification (this document) |

Evidence labels: **WIRED** (catalog-driven in API mode), **PARTIAL**, **HARDCODED**, **N/A** (not academic class/section), **GAP**.

---

## 1. Inventory — every class/section usage discovered

### 1.1 Shared infrastructure (canonical)

| Location | Role | Status |
|---|---|---|
| `backend/app/api/v1/endpoints/masters.py` | Admin/staff with `masters.read` / `masters.write` | **WIRED** SoT |
| `backend/app/models` `SchoolClass` / `Section` | DB | **WIRED** |
| `src/services/classDetailsApi.js` (`loadClassDirectory`, `ensureClassCatalogHydrated`, `refreshClassCatalog`) | All authenticated (read) | **WIRED** |
| `src/Common/RBAC/academicsCatalogData.js` (`mirrorApiClassDetails`, `getSectionsForClass`) | Shared FE store | **WIRED** |
| `src/Common/RBAC/useClassCatalogOptions.js` | Forms | **WIRED** |
| `src/context/AuthContext.jsx` (hydrate on login / session restore) | All roles | **WIRED** |
| `src/Pages/Admin/Class/ClassDetails/*` | Admin | **WIRED** CRUD + rename |

### 1.2 Already wired (prior pass + confirmed)

| Screen / module | Roles | Status |
|---|---|---|
| Principal Create Examination Timetable | Principal, Director | **WIRED** (`useClassCatalogOptions`) |
| Teacher Create Exam Schedule form | Teacher | **WIRED** |
| Principal Teacher Allocation form | Principal | **WIRED** (class-scoped sections) |
| Class Timetable section helpers | Principal, Coordinator, Director | **WIRED** (`getSectionOptions(className)`) |
| Mark Entry (API section list via `listSectionNamesForClassApi`) | Teacher, Coordinator | **WIRED** (API path); offline still uses catalog/hardcode |
| Student Allocation section picker | Coordinator / Principal / Director | **WIRED** |
| FO Student Re-Enrollment grades/sections | FO / PRM | **WIRED** (liveArray + catalog) |
| Teacher Online Class / Extra Class getters | Teacher | **WIRED** (no A/B/C in API mode) |
| Teacher/Coordinator Attendance filters | Teacher, Coordinator | **WIRED** |
| Admin Student Attendance filter options | Admin | **WIRED** |
| Transport StudentTransport **form** | Transport Manager | **WIRED** (loads directory + class details) |
| Teacher AssignedClass / UnitTests / Syllabus / QuestionBanks / HomeFun / StudyMaterials / MarksResults / LeaveRequest (re-export) | Teacher | **WIRED** via `assignedClassData` live catalog |
| Lesson plan `SECTION_OPTIONS` | Teacher, Coordinator | **WIRED** via assignedClass liveArray |

### 1.3 Remaining academic hardcodes / disconnects (actionable)

| Location | Issue | Severity |
|---|---|---|
| `src/Pages/Coordinator/AttendanceHistory/attendanceHistoryData.js` | `CLASSES=['9','10']`, `SECTIONS=['A','B']` | High |
| `src/Pages/Teacher/AttendanceHistory/attendanceHistoryData.js` | Same | High |
| `src/Pages/TransportManager/StudentTransport/StudentTransport.jsx` + `studentTransportData.CLASS_SECTIONS` | Hardcoded filter list `Grade 6 - A` … | High |
| `src/Common/MarkEntryApproval/MarkEntryPage.jsx` | On catalog load failure still comments “keep hardcoded fallbacks”; offline `SECTIONS` | Medium |
| `src/Common/LessonPlanApproval/lessonPlanApprovalData.js` | `CLASS_OPTIONS` prefixes `Grade ${item}` even when catalog already has `Grade 10` | Medium |
| Demo seeds in exam/allocation/attendance data files | Historical demo rows with Grade/A — OK if not used as dropdown SoT in API mode | Low |
| `placement.py` `_DEFAULT_SECTIONS = ("A","B","C")` | Auto-creates A/B/C when placing into a class with zero sections | Medium (server seed behaviour) |
| `exams.create_exam` / `update_exam` | Accepts free-text `class_name` / `section` **without** masters membership check | **High / P1** |
| Marks / attendance / admissions string labels | Many flows still store display names; placement uses `section_id` (good) | Partial |

### 1.4 Explicitly N/A (not academic class/section)

Do **not** wire these to Class Details:

| Location | Meaning |
|---|---|
| QA/PA Observation `SECTIONS = Observation/RCA/ATR/Timeline` | Report tabs |
| JD Audit / Process Auditor `CHECKLIST_SECTIONS` | Audit checklist |
| Account Head `ACCOUNTING_SECTIONS`, SuperAdmin `FINANCE_SECTIONS`, `AUDIT_REPORT_SECTIONS`, `OVERVIEW_SECTIONS` | Finance/report UI sections |
| Canteen `SECTION_OPTIONS` (if announcement audience chips — verify) | Non-academic if not grade sections |
| Approval matrix labels A1/A2/A3 | Workflow steps, **not** class sections |
| AEP / NA as masters values | Still **unconfirmed** taxonomy — do not seed |

### 1.5 Backend consumers of class/section

| Module | Validation today |
|---|---|
| Masters CRUD | Uniqueness + rename blocked if in use |
| Placement (`place_student` by `section_id`) | Active section FK |
| Academics class-timetables replace | `_campus_class_section_index` rejects unknown pairs |
| Exams create/update | **No** masters check (GAP) |
| Marks batches | Placement/class match tests exist |
| Attendance options | Built from active masters |
| Ops transport assignments | Student class/section strings |

---

## 2. Implementation plan (this pass)

1. Shared backend helper: require active class (+ optional section) against masters.  
2. Enforce on exam create/update.  
3. Wire Attendance History + Transport list filter to catalog.  
4. Harden Mark Entry API-mode failure (no silent A/B/C).  
5. Fix lesson-plan class option double-`Grade` prefix.  
6. Catalog error/retry surface on `useClassCatalogOptions`.  
7. Focused tests + `npm run build`.  
8. Update this doc + global workflow audit with results.

---

## 3. Files and APIs changed

### Backend
| File | Change |
|---|---|
| `backend/app/services/class_section_catalog.py` | **Added** — `campus_class_section_index`, `require_active_class`, `require_active_class_section` |
| `backend/app/services/exams.py` | Exam create/update call `require_active_class_section` |
| `backend/app/services/academics_collections.py` | Timetable index reuses shared helper |
| `backend/tests/test_exams.py` | `_approved_exam` ensures masters exist; new rejection test |

### Frontend
| File | Change |
|---|---|
| `src/Common/RBAC/useClassCatalogOptions.js` | Error status + `reload` (no silent A/B/C) |
| `src/Common/RBAC/ClassCatalogStatus.jsx` | **Added** error/retry banner |
| `src/Pages/Coordinator/AttendanceHistory/attendanceHistoryData.js` | Catalog liveArray |
| `src/Pages/Teacher/AttendanceHistory/attendanceHistoryData.js` | Catalog liveArray |
| `src/Pages/TransportManager/StudentTransport/studentTransportData.js` | `CLASS_SECTIONS` from Class Details |
| `src/Pages/TransportManager/StudentTransport/StudentTransport.jsx` | Hydrate catalog on list |
| `src/Common/LessonPlanApproval/lessonPlanApprovalData.js` | Avoid double `Grade` prefix |
| `src/Common/MarkEntryApproval/MarkEntryPage.jsx` | API-mode catalog failure surfaces error; no hardcoded fallback |
| Principal/Teacher exam forms | Show `ClassCatalogStatus` |

Prior pass (still in force): Auth hydrate, EditClassModal rename, Teacher Allocation, Exam schedule forms, Student Allocation, FO re-enrollment, Online/Extra class, Attendance filters.

## 4. Backend validation and permissions

| Check | Status |
|---|---|
| Exam create/update: class must be active master | **Enforced** |
| Exam create/update: section (if sent) must belong to that class and be active | **Enforced** |
| Class timetable replace: unknown class/section | **Already enforced** |
| Placement by `section_id` | **Already enforced** |
| `masters.write` for create/rename/deactivate | Admin family only (`masters.write`); other roles retain `masters.read` via `_CORE` |
| Destructive rename when section in use | **Already 409** |
| Admissions / finance free-text class | **Still incremental** (not fully gated this pass) |

## 5. Test results and browser evidence

| Suite | Result |
|---|---|
| `python -m pytest tests/test_exams.py tests/test_class_details_api.py -q --import-mode=importlib` | **12 passed** |
| Includes `test_exam_rejects_unknown_or_mismatched_class_section` | **PASS** |
| `npm run build` | **PASS** (~56s) |
| Browser UAT (Admin create → Principal/Coord/Teacher/Transport see section) | **Not run this pass** — code + API tests only |

## 6. Remaining blockers / incomplete coverage

- Partner confirmation of **A1 / A2 / AEP / NA** before any seed.  
- Browser UAT across all roles still required for “complete coverage” claim.  
- Admissions enquiry / fee structures / some demo seed lists may still accept free-text class labels without masters check.  
- Non-academic `SECTION` constants (audit checklists, finance report tabs) intentionally untouched.  
- Historical records keep stored display names; IDs used where already present (`section_id` placement).
