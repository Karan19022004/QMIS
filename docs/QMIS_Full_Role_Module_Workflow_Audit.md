# QMIS ERP — Full Role, Module, Permission and End-to-End Workflow Audit

| Field | Value |
|---|---|
| **Date** | 29 October 2026 |
| **Phase** | **1 — Audit only** (no application code, schema, data, env, or permission changes) |
| **Product** | Queen Mira International School (QMIS) ERP |
| **Primary sources** | `backend/app/permissions/matrix.py`, `backend/app/main.py`, API routers/services/models, `src/Common/CommonSidebar/Components/sidebarLinks.js`, `src/context/AuthContext.jsx`, `src/constants/roles.js`, existing docs under `docs/` and prior reports |
| **Environment (reference)** | Vite `:5173` → API `:8000` → local Postgres `qmis_erp`; `:8001` separate/untouched |
| **Browser UAT this pass** | **Not performed** (audit-only). Prior academic UAT evidence cited where labelled |

### Evidence labels

| Label | Meaning |
|---|---|
| **CONFIRMED** | Verified in source (and/or named prior automated/browser evidence). |
| **PARTIAL** | Implemented in some layers but incomplete, dual-path, or inconsistently wired. |
| **UNVERIFIED** | Exists as UI/route/endpoint but not proven end-to-end in this audit. |
| **GAP** | Expected / documented need differs from or is missing in implementation. |
| **SUSPECTED** | Likely defect from code pattern; not freshly reproduced this pass. |

---

## A. Role inventory

Backend role codes come from `ALL_ROLES` in `backend/app/permissions/matrix.py`. Frontend display keys in `roleBasedSidebarLinks` often use PascalCase labels; Auth uses backend codes via `ROLES` in `src/constants/roles.js`.

**Excluded from inventory / provisioning scope (per request):** Digital Marketing — appears only as HR **designation** text / seed staff, **not** as a portal role.  
**Missing role (requirement gap, not invented):** Hostel Warden — confirmed absent from `ALL_ROLES`, sidebar map, and Auth home paths (prior docs + matrix). Hostel gate-pass UI has a `wardenApproval` **field**, not a warden login.

| Display name | Backend code | Sidebar key | Home path (Auth) | Permissions (summary) | Status |
|---|---|---|---|---|---|
| Super Admin | `superadmin` | SuperAdmin | SA portal | All permission codes | **CONFIRMED** portal |
| Admin | `admin` | Administrator | Admin portal | All permission codes | **CONFIRMED** |
| Managing Director | `managing_director` | *(no dedicated sidebar entry)* | *(verify routing)* | All permission codes | **PARTIAL** — matrix yes; FE portal mapping thinner than Admin |
| Director | `director` | Director | Director portal | Academic staff + exams.configure + place/promote + FO read | **CONFIRMED** |
| Principal | `principal` | Principal | Principal portal | Academic staff + exams.write + place/promote | **CONFIRMED** |
| Joint Director | `jointdirector` | JointDirector | JD portal | `_STAFF_ACADEMIC` + ops | **PARTIAL** — many JD screens; ops/collections depth UNVERIFIED |
| Joint Director Assistant | `jointdirectorassistant` | JointDirectorAssistant | JDA portal | Mostly `_CORE` + leave/escalations/tasks/comms loops; **not** in `_OPS_ROLES` | **PARTIAL** / risk of under-permission vs UI |
| Joint Director Audit (DA) | `jointdirectoraudit` | JointDirectorAudit | Audit portal | campus_audit read/write | **CONFIRMED** code; UI depth UNVERIFIED |
| Process Auditor | `processauditor` | ProcessAuditor | process-auditor | campus_audit | **PARTIAL** |
| Quality Auditor | `qualityauditor` | QualityAuditor | quality-auditor | campus_audit | **PARTIAL** |
| Coordinator | `coordinator` | Coordinator | Coordinator | Academic + exams.write + place/promote + emp directory read | **CONFIRMED** |
| Teacher | `teacher` | Teacher | Teacher | Academic marks/exams.read (no exams.write) | **CONFIRMED** |
| PRM | `prm` | PRM | Front office admissions | admissions + FO + emp read | **CONFIRMED** (admissions officer mapping) |
| PRO | `pro` | *(not in roleBasedSidebarLinks)* | `/front-office/admission-enquiry` | Same admissions/FO bundle as PRM | **PARTIAL** — reuses FO routes; sidebar map gap |
| Parent | `parent` | Parent | Parent portal | results, attendance, exams/academics read, finance.read+pay | **CONFIRMED** |
| Student | `student` | Student | Student portal | Similar to parent (self) | **CONFIRMED** |
| Account Head | `accounthead` | AccountHead | `/account-head/…` | finance head + ops.read | **CONFIRMED** |
| Finance Manager | `financemanager` | *(shares Account Head home)* | `/account-head/dashboard` | Same `_FINANCE_HEAD` as accounthead | **PARTIAL** — separate code; shared FE portal |
| Finance Assistant | `finance_assistant` | *(Account Head family)* | account-head | collect/read only | **PARTIAL** |
| Account Assistant | `accountassistant` | *(Account Head family)* | `/account-head/dashboard` | Same as finance_assistant | **PARTIAL** |
| HR | `hr` | HR | HR portal | HR + leave decide + employee docs | **CONFIRMED** |
| Transport Manager | `transportmanager` | TransportManager | TM portal | ops + students.read | **PARTIAL** E2E tracking UNVERIFIED |
| Driver | `driver` | Driver | Driver portal | ops (scoped) | **PARTIAL** |
| Librarian | `librarian` | Librarian | Library portal | ops library collections | **PARTIAL** |
| Gate Keeper | `gatekeeper` | GateKeeper | Gate portal | FO + ops gate | **PARTIAL** |
| Gate Keeper Manager | `gatekeepermanager` | GateKeeperManager | GKM portal | FO + ops + leave.decide | **PARTIAL** |
| Canteen Manager | `canteenmanager` | CanteenManager | Canteen | ops canteen | **PARTIAL** |
| IT Support Manager | `itsupportmanager` | ITSupportManager | IT | ops IT | **PARTIAL** |
| Stationery Store Manager | `stationerystoremanager` | StationeryStoreManager | Stores | `_CORE`+approvals (+ ops via loop) | **PARTIAL** |
| Housekeeping Manager | `housekeepingmanager` | HousekeepingManager | HK | ops HK | **PARTIAL** |

**Note:** There is **no** `directoraudit` code — Director of Audit maps to **`jointdirectoraudit`**. Do not invent `directoraudit`.

---

## B. Module inventory

| # | Module | Frontend | Backend API | Persistence | Permissions | Integrations | Test / UAT evidence |
|---|---|---|---|---|---|---|---|
| 1 | Auth (login/logout/password) | Sign-in, change-password | `/api/v1/auth/*` | users | auth.me | — | Prior auth stability tests; academic UAT logins **CONFIRMED** |
| 2 | RBAC / users / campus | SuperAdmin user creation, Admin users | `/rbac`, `/admin` users | roles, permissions, users | rbac.*, users.* | — | Seed + provision docs; full UI matrix **UNVERIFIED** |
| 3 | Masters (AY, class, section, subject) | Class Details, Subjects | `/masters/*` | academics tables | masters.* | — | Admin CRUD **CONFIRMED** in code; FE hardcoding remains (**GAP**) — see class/section audit |
| 4 | Admissions / enquiry / enroll | Admin + FO + PRM/PRO | `/admissions/*` | admissions, students | admissions.write | — | Academic E2E audit **CONFIRMED**; no admit-approve FSM (**GAP** vs some SOPs) |
| 5 | Placement / promote | Coord/Principal | `/students/*/place|promote` | student FKs | students.place/promote | — | **CONFIRMED** + prior UAT |
| 6 | Teacher allocation / class timetable | Principal/Coord | `/academics` collections | AcademicsRecord JSON | academics.* | — | Module1/2 audits; browser depth **PARTIAL** |
| 7 | Attendance | Teacher/Coord/parent calendars | `/attendance` | attendance tables | attendance.* | leave on-leave | Dual-session migration `0023`; full UAT **UNVERIFIED** |
| 8 | Leave + hourly Permission | Common LeaveRequest + HR | `/leave-requests` | leave_requests + approvals | leave.* | attendance on-leave | Pytest leave suite **CONFIRMED**; half-day/cancel **GAP** |
| 9 | Exams / marks / correction / results | Principal/Teacher/approvers/parent | `/exams`, marks-batches, results | exams, marks, approvals | exams.*, marks.*, results.* | in-app notify | Academic gap-fix + Postgres UAT **SUBSTANTIALLY PASSED** |
| 10 | Lesson plans | Teacher + approvers | `/lesson-plans` | lesson plans + approvals | lessonplans.* | — | API present; UI memory-only risks noted in older audits **SUSPECTED** |
| 11 | Parent/student portals | Parent/Student sidebars | results, attendance, academics, finance.pay | scoped | role-scoped | — | Results UAT **CONFIRMED** for parent; full portal **PARTIAL** |
| 12 | Finance / fees / payments | Account Head family | `/finance`, webhooks | finance tables | finance.* | Razorpay webhook | Trusted status must be webhook/backend — FE-only success is **GAP/SUSPECTED**; full suite had Razorpay-related fails historically |
| 13 | HR / employees / payslips | HR portal | `/hr` | HR models | hr.* | leave bridge FE | Domain store + API mix **PARTIAL** |
| 14 | Transport / ProTrack | TM + Driver + parent track | `/ops` transport-* + `/protrack` | ops JSON collections | ops.*, protrack | ProTrack API | Tracking config-dependent **UNVERIFIED** live |
| 15 | Library | Librarian | ops `library-*` | ops collections | ops.* | — | **UNVERIFIED** E2E |
| 16 | Gate / visitors / passes | Gate + FO | FO + ops gate-* | FO + ops | frontoffice.*, ops.* | — | Hostel warden field without role **GAP** |
| 17 | Stores / stationery / shared inventory | Store managers | ops stationery/shared | ops | ops.* | — | **UNVERIFIED** |
| 18 | Canteen | Canteen Manager | ops canteen-* | ops | ops.* | — | Persist hardening noted in daily report; full UAT **UNVERIFIED** |
| 19 | IT support | IT Support Manager | ops it-* | ops | ops.* | — | **UNVERIFIED** |
| 20 | Housekeeping | HK Manager | ops hk-* | ops | ops.* | — | **UNVERIFIED** |
| 21 | Documents / files | Admin/HR/Principal | `/documents`, `/files` | uploads + DB | documents.*, users.write | — | Upload path exists; exhaustive ACL UAT **UNVERIFIED** |
| 22 | Announcements / calendar / TC / activities / communication | Role pages | dedicated routers | tables/collections | announcements, calendar, tc, activities, communication | notify_event | **PARTIAL** |
| 23 | Escalations / tasks | Many roles | escalations router | tables | escalations.*, tasks.* | — | **PARTIAL** |
| 24 | Campus audit (JD Audit / PA / QA) | Auditor portals | `/campus-audit` | collections | campus_audit.* | — | **UNVERIFIED** E2E |
| 25 | Dashboard / audit logs | Admin/SA | `/admin` dashboard, `/audit-logs` | audit | dashboard.read, audit.read | — | **PARTIAL** |
| 26 | Hostel (assignments/payments) | Parent/student hostel screens | ops `hostel-*` | ops collections | ops (limited roles) | — | **UI demo/static risk**; no Hostel Warden role **GAP** |
| 27 | Star ratings / SOM | Principal/Director/Teacher | ops som-* | ops | ops | — | REST decision pending in prior reports |

**Dual-path warning:** Many modules use `canUse*Api()` flags + `localStorage` / `liveArray` fallbacks. In API mode, silent demo fallbacks are a recurring **P1** risk.

---

## C. Inter-role workflow matrix

### C1. Academics (enrol → publish)

| Step | Actor | Action | SoT | Downstream visibility | Auth | Status |
|---|---|---|---|---|---|---|
| Enquiry | Admin/PRM/PRO | Create enquiry | admissions | FO lists | admissions.write | **CONFIRMED** |
| Admission | same | Convert / create | admissions | — | admissions.write | **CONFIRMED** — no Principal/Director admit approve (**GAP** if SOP requires) |
| Enrol | Admin/PRM | Enroll | students + optional parent/student users | Parent/Student accounts | admissions.write | **CONFIRMED** |
| Place | Coord/Principal | Section + roll | student placement FKs | Teacher roster (if class teacher/allocation) | students.place | **CONFIRMED** + UAT |
| Allocate / timetable | Principal/Coord | Academics collections | AcademicsRecord | Teacher/student TT | academics.write | **PARTIAL** |
| Exam create/submit | Principal/Coord | Exam + schedule | exams | Director inbox | exams.write | **CONFIRMED** |
| Exam approve | **Director only** | decide exam_timetable | approvals | Marks unlock | approvals.decide | **CONFIRMED** |
| Marks submit | Teacher/Coord | marks_batch | marks | Coord→Principal→Director | marks.write | **CONFIRMED** |
| Publish | Director final marks approve | status published | marks | Parent/Student results + in-app notify | approvals | **CONFIRMED** (+ notify isolation tests) |
| Correction | Teacher request → Principal → Director | marks_correction | new version | Parent updated marks | marks.write + decide | Teacher UI **CONFIRMED**; Principal/Director decide UI **PARTIAL** |

Self-approval: Teacher cannot decide own correction (**CONFIRMED** API 403).

### C2. Admissions / fees / parent access

| Step | Actor | Notes | Status |
|---|---|---|---|
| Fee after enroll | Account Head / collectors | finance structures + collect | **PARTIAL** — trust backend/webhook |
| Parent finance | Parent | finance.read + finance.pay | **CONFIRMED** permissions; payment E2E **UNVERIFIED** this pass |

### C3. Leave / HR

| Step | Actor | Notes | Status |
|---|---|---|---|
| File leave/permission | Any staff (not parent/student) | leave.write; Permission ≤2h; Casual+Personal ≤2 days/month | **CONFIRMED** code+pytest |
| Decide | Dept head then HR | leave.decide; chain in leave.py | **CONFIRMED** |
| Attendance | HR/teachers via on-leave | Approved → Leave/Permission mark | **CONFIRMED** API |
| Payroll bridge | HR FE | leaveHrPayrollBridge | **PARTIAL** — FE sync |

### C4. Transport

| Step | Actor | SoT | Status |
|---|---|---|---|
| Vehicles/routes/assign | Transport Manager | ops transport-* | **PARTIAL** |
| Duty view | Driver | ops driver collections | **PARTIAL** |
| Live track | ProTrack proxy | external | **UNVERIFIED** without live credentials |
| Parent track | Parent | scoped | **UNVERIFIED** |

### C5. Library / Gate / Stores / Canteen / IT / HK

Generic pattern: Manager creates via ops collection → same role + Admin read/write → reports local to portal. Cross-role visibility often Admin/Principal only. **Full E2E UNVERIFIED** in this audit; treat as P2 until browser evidence exists.

### C6. Failure behaviour (cross-cutting)

| Concern | Observed pattern | Status |
|---|---|---|
| Notify failure after publish | Marks commit then notify; isolation tests | **CONFIRMED** academics |
| Payment FE success without webhook | Risk if UI marks paid early | **SUSPECTED** finance |
| API down / Failed to fetch | Some screens show error; connection slots amplify | **CONFIRMED** env issue (pgAdmin) |
| Duplicate submit | Approvals/leave have conflict checks; not universal | **PARTIAL** |

---

## D. Defect register

| ID | Severity | Roles / modules | Finding | Expected vs actual | Locations | Evidence | Fix direction | Tests |
|---|---|---|---|---|---|---|---|---|
| F-001 | **P0** | All / Postgres ops | Connection slots exhausted by **pgAdmin ~90–92** conns | Healthy pool for app + tools | Local PG `max_connections=100` | Closure diagnostics 29 Oct | Ops close pgAdmin (approval); do not raise limits blindly | N/A ops |
| F-002 | **P0** | Prod / exams | Remote DB may lack `exams.schedule` | Migration head includes `0022` | Alembic; gap-fix report | Local at `0023` **CONFIRMED**; prod **UNVERIFIED** | Scheduled `alembic upgrade head` after backup | Association tests |
| F-003 | **P1** | Many FE modules | Hardcoded class/section/subject dropdowns vs masters | Dropdowns from API masters | Exam/TT/allocation/attendance data.js files | Class/section audit + **29 Oct catalog consistency pass** reduced remaining hardcodes (Attendance History, Transport filter, Mark Entry failure path, exam API validation). See `docs/QMIS_Class_Section_Catalog_Consistency_Audit.md`. Residual: admissions free-text, A1/A2/AEP/NA taxonomy, browser UAT | Continue masters wiring; no fake fallbacks in API mode | FE static + API |
| F-004 | **P1** | Teacher Mark Entry | Empty student list without class-teacher/allocation | Roster scoped — correct but opaque | students.list_students | Postgres UAT | UX messaging + ensure allocation | Access tests |
| F-005 | **P1** | Teacher Mark Entry | Subject masters often English-only; batches use free-text `Maths` | Masters align with exam subjects | subjects + MarkEntryPage | UAT | Admin restore DEFAULT_SUBJECTS / naming policy | — |
| F-006 | **P1** | Finance | Payment status must not trust FE alone | Backend/webhook SoT | finance + webhooks | Historical Razorpay test fails | Harden webhook path; FE waits for confirmed status | finance tests |
| F-007 | **P1** | Dual-mode modules | Demo/localStorage success while API mode intended | API persistence or clear offline banner | `canUse*Api`, liveArray | Code pattern | Fail closed in API mode | static tests |
| F-008 | **P1** | PRO / Finance Manager / Assistant | Backend roles exist; sidebar map incomplete / shared Account Head UI | Distinct nav/permissions as designed | sidebarLinks vs Auth ROLE_HOME_PATHS | Code | Dedicated sidebars or explicit shared-portal docs | role portal tests |
| F-009 | **P1** | Joint Director Assistant | UI portal vs thin permission set | UI actions match matrix | matrix vs JDA pages | Code review | Align perms or hide unauthorized nav | permission tests |
| F-010 | **P2** | Hostel | No Hostel Warden role; `wardenApproval` field orphan | Warden login or remove field | FO hostel passes | Prior system audit | Product decision | — |
| F-011 | **P2** | Class/section | Requested A1/A2/AEP/NA vocabulary unclear | Confirmed taxonomy before seed | Class/section audit | Audit doc | Partner confirmation | — |
| F-012 | **P2** | Leave | No half-day, cancel, start/end time, attachment; Permission–Permission overlap allowed | Policy-complete leave | leave.py | Code + leave audit | Confirm policy then implement | extend test_leave |
| F-013 | **P2** | Approvals UI | Principal Mark Entry Approval `Failed to fetch` under slot pressure | Reliable inbox | Mark Entry Approval | Academic UAT | Env fix + retry UX | — |
| F-014 | **P2** | Ops verticals | Library/Gate/Stores/Canteen/IT/HK largely collection CRUD | Proven cross-role workflows | ops_collections | Code only this pass | Browser UAT per vertical | — |
| F-015 | **P2** | Lesson plans | Older notes: UI memory-only vs API | API SoT | lesson plan pages | Prior audit | Confirm wiring | lesson plan tests |
| F-016 | **P3** | Reports/dashboards | Risk of disagreement with SoT | Reports from same APIs | various | **UNVERIFIED** | Snapshot tests vs APIs | — |
| F-017 | **P3** | Integrations | Email/WhatsApp/ProTrack appear configured but may be demo | Clear “not configured” state | notify_event, protrack | Docs + code | Status banners | — |
| F-018 | **Low** | models | Dual `masters.py` vs `academics.py` model files | Single canonical import path | models/ | Code | Deprecate legacy path | — |

**Confirmed vs suspected:** F-001–F-005, F-008–F-012, F-018 are code/evidence backed. F-006, F-007, F-013–F-017 need targeted reproduction or env-dependent verification.

---

## E. Dependency map (recommended order)

```text
1. Auth + RBAC + campus isolation + connection hygiene (pgAdmin)
2. Masters (academic year, class, section, subject) — single SoT, no hardcoded FE
3. Admissions → Student → Placement → Parent/Student users
4. Teacher allocation / class teacher → Timetable
5. Exams → Marks → Approvals → Results → Notifications
6. Attendance + Leave (policy-complete) → HR payroll bridge
7. Finance collect/pay + webhook truth
8. Transport ops + ProTrack (credentials)
9. Library / Gate / Stores / Canteen / IT / HK ops UAT
10. Campus audit portals + reporting consistency
11. Hostel (only after Warden role decision)
```

Resolve **master data, ownership, and authorization** before dependent workflows.

---

## F. Prioritized implementation plan

### P0 — Security / money / data exposure / env blockers
1. Clear pgAdmin connection exhaustion with ops approval (F-001).  
2. Confirm production Alembic head / `exams.schedule` (F-002) — schedule upgrade; **do not run prod migration from UAT**.  
3. Finance payment status from trusted backend/webhook only (F-006).  
4. API-mode kill switches: no silent demo writes (F-007).  

### P1 — Critical workflow / persistence / visibility
1. Eliminate hardcoded class/section/subject in API mode (F-003, F-005).  
2. Finish Principal/Director approval UI reliability for marks correction (F-013).  
3. Align PRO / Finance Manager / Account Assistant / Finance Assistant portals with matrix (F-008).  
4. Align Joint Director Assistant permissions vs UI (F-009).  
5. Teacher roster messaging / allocation prerequisites (F-004).  

### P2 — Incomplete modules / ops / policy
1. Partner confirm A1/A2/AEP/NA taxonomy; then masters only (F-011).  
2. Leave policy answers → half-day/cancel/times/overlap (F-012).  
3. Browser UAT for Library, Gate, Stores, Canteen, IT, HK, Transport track (F-014).  
4. Hostel Warden decision (F-010).  
5. Lesson plan API/UI consistency (F-015).  

### P3 — Usability / reporting / polish
1. Dashboard/report reconciliation (F-016).  
2. Integration “not configured” UX (F-017).  
3. Retire legacy masters model path (F-018).  

---

## G. Verification summary

| Activity | Result |
|---|---|
| Static role matrix inventory | **Done** — **30** codes in `ALL_ROLES` (`FRONTEND_ROLES` 28 + `managing_director` + `finance_assistant`) |
| API router inventory | **Done** — auth, rbac, masters, admissions, students, attendance, exams, leave, finance, hr, ops, academics, campus-audit, protrack, webhooks, etc. |
| FE sidebar / Auth home paths | **Done** — gaps for PRO/finance variants and MD noted |
| Prior academic UAT evidence | Cited: placement, schedule, marks, correction, parent results; 11 focused pytest; npm build PASS (29 Oct) |
| Browser UAT this Phase 1 audit | **Not run** (audit-only) |
| Full pytest suite this pass | **Not re-run** |
| Code/schema/data changes | **None** |
| Production migrations | **None** |
| `:8001` environment | **Untouched** |

### Remaining risks
- Environment connection pressure from pgAdmin.  
- Ops and finance modules largely **UNVERIFIED** at browser E2E.  
- Ambiguous class/section vocabulary and leave half-day/holiday rules.  
- Dual FE/API modes masking incomplete backends.  

### Related documents
- `docs/QMIS_End_to_End_Academic_Examination_Results_Audit.md`  
- `docs/QMIS_Academic_Workflow_Gap_Fix_Report.md`  
- `docs/QMIS_Class_Section_Leave_Permission_Audit.md`  
- `docs/QMIS_Module1_Class_Teacher_Allocation_Audit.md`  
- `docs/QMIS_Module2_Timetable_Audit.md`  
- `reports/testing-report.md`, `reports/daily-work-report.md`  

---

## Clarifications required before broad fixes

1. Confirm **A1 / A2 / AEP / NA** taxonomy (section vs class vs other).  
2. Leave: half-day, weekends/holidays, permission overlap/budget, cancel/withdraw.  
3. Whether **Hostel Warden** should become a login role or FO field-only.  
4. Whether **Finance Manager / Account Assistant / Finance Assistant / PRO** should keep shared portals or get distinct nav.  
5. Production Alembic revision confirmation (read-only check by ops).  

**Phase 1 complete.** Do not start broad implementation until this plan is accepted and blockers above are answered where they gate specific workstreams.
