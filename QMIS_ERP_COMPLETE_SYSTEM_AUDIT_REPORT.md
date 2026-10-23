# QMIS ERP — Complete System-Wide Requirements and Integration Audit

**Date:** 23 October 2026  
**Branch:** `ERP1`  
**Pinned commit inspected for structure:** `26c0f0b9f36dd3d3be3cb5c549b54d43b3a50673`  
**Working tree:** Dirty (~150 paths). Uncommitted work includes campus ops/audit wiring, finance parent scoping, notify hooks, front-office gate-pass ACL, FE portal fixes, Archify overview, and documentation cleanup. Evidence below distinguishes **committed HEAD** vs **working-tree / prior browser** findings.  
**Method:** Code inspection, existing partner reports (`REMAINING_MODULES_IMPLEMENTATION_REPORT.md`, `reports/testing-report.md`, `reports/daily-work-report.md`), campus collection registry, RBAC/matrix, then live `pytest` and `npm run build`.  
**Exclusions honored:** No payment-gateway changes, no live bus tracking enablement, no live email/WhatsApp sends, no new roles, no commit/push/deploy, no destructive git operations.

Status vocabulary: `PASS` · `PARTIAL` · `FAIL` · `BLOCKED` · `NOT IMPLEMENTED` · `NOT TESTED`

---

## 1. Executive summary

QMIS is a multi-role school ERP with a shared JWT sign-in, FastAPI `/api/v1` surface, PostgreSQL (campus-scoped SQL models), and JSON campus collections for ops/audit. **Twenty-six frontend portal roles** are routed in `App.jsx`. Backend also knows `managing_director` (seed matrix) but there is no dedicated portal for it.

**Overall readiness:** Not production-stable. Core academics/finance/HR/auth paths are largely API-backed with automated coverage. Operational portals (library, gate, transport, stores, canteen, IT, HK, audit) persist through `/api/v1/ops` and `/api/v1/campus-audit` when API mode is on, but **many screens remain PARTIAL** after browser spot-checks: incomplete CRUD walkthroughs, at least one success-without-save path (canteen orders), FE-only SoT islands (Director/Principal star ratings), payment gateway still mocked, ProTrack credentials absent, SMTP/WhatsApp `NOT_CONFIGURED`, and Track Bus `BLOCKED`.

| Area | Verdict |
|---|---|
| Auth + role URL isolation | `PASS` (structure + prior browser role-bounce) |
| Campus SQL isolation (`campus_id`) | `PARTIAL` (widely used; multi-campus adversarial tests not run this audit) |
| Parent/student fee scoping | `PASS` (API tests + prior browser checkout) |
| Ops/audit campus collections | `PARTIAL` (API tests + selective browser) |
| Email / WhatsApp | `PARTIAL` (hooks + mock tests; not LIVE_VERIFIED) |
| Live bus tracking | `BLOCKED` |
| Payment gateway | `NOT TESTED` / mocked UI (excluded from change) |
| Super Admin / Admin full panel walkthrough | `NOT TESTED` this audit |
| Stable for school go-live | **No** |

**Automated evidence (executed this audit):**

| Check | Result |
|---|---|
| `python -m pytest tests/ -q` (from `backend/`) | **460 passed**, 0 failed, ~3m 47s |
| `npm run build` | **passed**, ~45s |

**Browser evidence:** Not re-executed end-to-end in this audit pass. Statuses that cite browser rely on the 23 October verification recorded in `REMAINING_MODULES_IMPLEMENTATION_REPORT.md`. Those remain `PARTIAL` / `BLOCKED` as documented there—not upgraded to `PASS`/`COMPLETE`.

---

## 2. Complete role and module inventory

### 2.1 Frontend portal roles (`src/constants/roles.js`)

| Role code | Home path | Primary domains |
|---|---|---|
| `superadmin` | `/super-admin/dashboard` | Platform / campuses / system |
| `admin` | `/admin/front-office/admission-list` | Admin FO, users (limited creatable set), masters |
| `prm` | `/front-office/admission-enquiry` | Admissions / enrollment |
| `director` | `/director/broadcast` | Broadcast, tasks, ratings (FE SoT) |
| `principal` | `/principal/task-management` | Tasks, exams, ratings (FE SoT) |
| `coordinator` | `/coordinator/dashboard` | Academic coordination |
| `teacher` | `/teacher/dashboard` | Class, attendance, lesson plans, marks |
| `student` | `/student/class/online-class` | Student portal / fees |
| `parent` | `/parent/select-child` | Linked children / fees / transport view |
| `hr` | `/hr/dashboard` | Staff, onboarding, leave, payroll hooks |
| `accounthead` / `finance_assistant` | `/account-head/dashboard` | Finance ledger / collect |
| `transportmanager` | `/transport-manager/dashboard` | Fleet ops (not driver login provision) |
| `driver` | `/driver/vehicle-management/vehicle-details` | Assigned vehicle / duty / health |
| `gatekeeper` / `gatekeepermanager` | `/gate-keeper/...` / `/gatekeeper-manager/...` | Visitors, passes (GK read-only on passes) |
| `librarian` | `/librarian/book-management/book-list` | Catalogue, issue/return |
| `canteenmanager` | `/canteen-manager/dashboard` | Menu, inventory, orders |
| `itsupportmanager` | `/it-support-manager/dashboard` | Assets, tickets |
| `stationerystoremanager` | `/stationery-store-manager/dashboard` | Stock, issue/return |
| `housekeepingmanager` | `/housekeeping-manager/dashboard` | Schedules, HK inventory |
| `jointdirector` / `jointdirectorassistant` / `jointdirectoraudit` | `/joint-director...` | JD chrome / audit assign |
| `processauditor` / `qualityauditor` | `/process-auditor/...` / `/quality-auditor/...` | Field audit |

**Not system portal roles (by design):** Hostel Warden, Admission Officer. PRM remains admissions. Warden appears only as HR designation / FO field text, not a login role.

**Admin user-creation (Admin UI):** Only Principal, PRM, Teacher, Coordinator, Librarian, Gate Keeper Manager, Gate Keeper (`CREATABLE_ROLE_OPTIONS` in `createdUsersData.js`). Other staff logins (Driver, TM, Stores, etc.) are expected via **HR staff creation / onboarding**, not Admin user-creation.

### 2.2 Backend routers (`backend/app/main.py`)

Mounted: auth, audit-logs, admin users, masters, admissions, parents, students, attendance, approvals, lesson-plans, exams, leave, escalations, finance, hr, files, documents, announcements, calendar, tc-requests, activities, communication, dashboard, front-office, academics collections, **ops**, **campus-audit**, **protrack**, webhooks. Health: `GET /health`.

### 2.3 Persistence mechanisms

| Mechanism | Used for |
|---|---|
| PostgreSQL + Alembic (head `0018_exam_academic_year` on HEAD) | Users, students, attendance, finance snapshot pieces, HR, FO records, ops/audit JSON rows (`OpsRecord` / campus audit models), etc. |
| `/api/v1/ops/{collection}` | Library, gate, transport, canteen, IT, stationery, HK, biometric, etc. |
| `/api/v1/campus-audit/{collection}` | Audit assignments, process/quality fieldwork |
| `/api/v1/front-office/...` | Gate passes and FO collections (gatekeeper read-only on `*gate-passes`) |
| Browser `localStorage` | Offline/demo fallback via `campusJsonStore`; **Director/Principal star ratings** still FE SoT; some legacy admission/mark/timetable helpers still touch storage when API flags off |
| External | SMTP / WhatsApp (empty → `NOT_CONFIGURED`); ProTrack365 (empty → 503 / not configured) |

---

## 3. Requirements traceability matrix (summary)

Full school requirement PDFs remain under `erp complete documentation/`. Traceability below links **capability → FE → BE → store → permission → evidence**.

| ID | Requirement | Frontend | Backend | Persistence | Permission / ACL | Evidence / status |
|---|---|---|---|---|---|---|
| R-AUTH-01 | Shared sign-in, JWT session | `/signin`, `AuthContext` | `/api/v1/auth` | users | Bearer + `must_change_password` | API tests `PASS`; browser prior `PASS` |
| R-AUTH-02 | Role cannot open another role URL | `App.jsx` guards | N/A (FE) + API RBAC | — | Role home redirect | Prior browser IT→stationery bounce `PASS` |
| R-ADMIN-01 | Admin creates limited staff roles | Admin user creation | `/admin` users API | users | creatable set | Code `PASS` structure; full UI walkthrough `NOT TESTED` |
| R-HR-01 | HR provisions staff including Driver | HR Employees / Offers | `/hr` create staff | users + HR | HR permission | API tests create department roles `PASS` |
| R-HR-02 | TM does not create driver logins | Transport Manager UI | ops `transport-drivers` only | ops rows | No user provision in ops replace | Code review `PASS` |
| R-ADM-01 | PRM admissions → enroll | PRM FO | `/admissions` | students/parents | PRM/admin | Suite covers admissions; full browser enroll this audit `NOT TESTED` |
| R-FEE-01 | Parent/student scoped fees | Parent/Student Academic Payment | `GET /finance/my-fees`, `POST .../pay-my-fees` | finance state | `finance.read`; parent/student only for pay | Pytest + prior browser `PASS` |
| R-FEE-02 | Parent cannot read full campus ledger | FinanceContext API mode | finance state ACL | finance | write/collect required for campus state | Pytest `PASS` |
| R-FEE-03 | Payment gateway live checkout | Gateway modals (mocked copy) | gateway-intent/confirm exist | — | finance | UI mocked — `NOT TESTED` live; excluded from change |
| R-OPS-LIB | Library catalogue / issue / return | Librarian pages | `/ops/library-*` | OpsRecord | librarian (+ admin) | Prior browser create `PARTIAL`; issue/return not re-walked |
| R-OPS-GATE | Gate visitors; passes read-only for GK | Gatekeeper pages | FO `*gate-passes` + ops visitors | FO + ops | GK read passes; no write | Prior browser + pytest `PARTIAL` |
| R-OPS-TM | Vehicles, routes, duties, maintenance | TM pages | `/ops/transport-*` | OpsRecord | transportmanager | Prior browser `PARTIAL` |
| R-OPS-DRV | Driver sees assigned vehicle only | Driver pages | ops replace scoped | OpsRecord | driver | Pytest + prior browser `PARTIAL` |
| R-OPS-STORES | Stationery inventory / issue | Stationery pages | `/ops` stationery collections | OpsRecord | stationerystoremanager | Inventory prior browser `PARTIAL`; issue click `NOT TESTED` |
| R-OPS-CANTEEN | Menu + orders | Canteen pages | `/ops/canteen-*` | OpsRecord | canteenmanager | Menu `PARTIAL`; orders success UI without durable save → `FAIL` |
| R-OPS-IT | Assets / tickets | IT pages | `/ops` IT collections | OpsRecord | itsupportmanager | Asset prior `PARTIAL`; tickets `NOT TESTED` |
| R-OPS-HK | Schedules | HK pages | `/ops/hk-*` | OpsRecord | housekeepingmanager | Prior create/refresh `PARTIAL` |
| R-AUD-01 | Audit assignments persist | JD Audit assign screens | `/campus-audit/audit-assignments` | Campus audit | jointdirectoraudit / auditors | Pytest + prior browser `PARTIAL` |
| R-NOTIFY-01 | Email/WA after business events | N/A (server) | `integrations/notify.py` + hooks | outbox / provider | secrets server-only | Mock/`NOT_CONFIGURED` tests `PARTIAL`; live `BLOCKED` |
| R-GPS-01 | Live bus position for plate/IMEI | Track Bus / ProTrack helpers | `/protrack/*` | external | transport/parent panels | Credentials empty → `BLOCKED` |
| R-GPS-02 | No silent fallback to another bus | `useProtrackLive.js` | proxy | — | — | Code: `devicesList[0]` fallback → **`FAIL` (must not enable live map until removed)** |
| R-ISO-01 | Campus isolation on writes | all portals | services filter `actor.campus_id` | DB | JWT campus | Code pattern `PARTIAL`; cross-campus attack suite `NOT TESTED` |
| R-STAR-01 | Staff star ratings multi-user | Director/Principal Star Ratings | **none** | localStorage | FE only | `NOT IMPLEMENTED` (REST) / FE SoT `PARTIAL` |
| R-HOSTEL | Hostel Warden role | — | — | — | — | `NOT IMPLEMENTED` (excluded) |

---

## 4. Implemented / partial / missing / broken

### 4.1 Platform and administration

| Item | Status | Notes |
|---|---|---|
| Super Admin portal exists | `NOT TESTED` | Layout mounts; no systematic browser audit this pass |
| Admin portal + limited user creation | `PARTIAL` | Creatable roles subset verified in code |
| Auth lockout / OTP settings | `PARTIAL` | Present in config/services; not re-tested here |
| System-wide reports | `NOT TESTED` | |
| Campus/org configuration UI | `NOT TESTED` | `campus_id` on models; multi-campus ops `NOT TESTED` |

### 4.2 Academic and admissions

| Item | Status | Notes |
|---|---|---|
| PRM enquiry → enroll | `PARTIAL` | Backend + FE present; enroll→notify hook in WT; full browser `NOT TESTED` this audit |
| Teacher attendance / lesson plans / marks | `PARTIAL` | APIs mounted; suite coverage exists; panel completeness varies historically |
| Coordinator / Director / Principal panels | `PARTIAL` / `NOT TESTED` | Star ratings localStorage; many screens not re-walked |
| Student / Parent portals | `PARTIAL` | Fee path browser-verified earlier; other menus not fully walked |
| Academic masters | `PARTIAL` | Masters router mounted |

### 4.3 Finance

| Item | Status | Notes |
|---|---|---|
| Account Head ledger / collect | `PARTIAL` | Large FE; API SoT for state; assistant collect-only |
| Parent/student my-fees + pay | `PASS` (API + prior browser) | Cash/cheque blocked for family pay |
| Transport fee separation | `PARTIAL` | Assignment/fee posts exist; full matrix `NOT TESTED` |
| Expenses / budgets / FS | `PARTIAL` | Present in Account Head; depth `NOT TESTED` |
| Gateway / PDF receipts | Mocked UI | Excluded from change; not live-verified |

### 4.4 HR

| Item | Status | Notes |
|---|---|---|
| Staff create + login provision | `PASS` (API tests for department roles) | Includes driver mapping |
| Leave submit/approve + notify | `PARTIAL` | Hooks in WT; live mail `NOT_CONFIGURED` |
| Payroll / concessions | `PARTIAL` | Cross-posts to finance exist; UI stubs for payslip send |
| Driver via HR only | `PASS` (code) | |

### 4.5 Transport

| Item | Status | Notes |
|---|---|---|
| TM vehicles/routes/duties | `PARTIAL` | Browser save/refresh earlier; vehicle list may be incomplete after wipe |
| Driver assigned vehicle / health | `PARTIAL` | |
| Expenses / student-transport save | `NOT TESTED` | Forms wired; not clicked in last browser pass |
| Live tracking | `BLOCKED` | Empty ProTrack env; demo geometry remains |
| First-device GPS fallback | `FAIL` | `useProtrackLive.js` uses `devicesList[0]` when plate/IMEI miss |

### 4.6 Operational services

| Module | Status | Highest defect |
|---|---|---|
| Gate | `PARTIAL` | Passes readable after API reload; GK cannot write |
| Librarian | `PARTIAL` | Catalogue persists; issue/return not re-verified |
| Stores | `PARTIAL` | Inventory persists; issue/return click `NOT TESTED` |
| Canteen menu | `PARTIAL` | Persists |
| Canteen orders | `FAIL` | Success modal path without confirmed durable save |
| IT assets | `PARTIAL` | Persists |
| IT tickets | `NOT TESTED` | Dashboard may still reference browser store copy |
| Housekeeping | `PARTIAL` | Schedule create/refresh earlier |

### 4.7 JD / Process / Quality audit

| Item | Status | Notes |
|---|---|---|
| Assignments CRUD | `PARTIAL` | Campus-audit collection + prior browser |
| Observations / findings / evidence | `PARTIAL` | Process paths persist in tests; full QA matrix `NOT TESTED` |
| Cross-role visibility rules | `NOT TESTED` | |

### 4.8 Email and WhatsApp

| Item | Status | Notes |
|---|---|---|
| Server notifier | `PARTIAL` | `NOT_CONFIGURED` / `MOCK_QUEUED` / no fake delivered |
| Event hooks (enroll, leave, announce, ops status, audit) | `PARTIAL` | Present in working tree; not LIVE_VERIFIED |
| Live send | `BLOCKED` | No SMTP/WA secrets |

---

## 5. Frontend → backend → database mapping

| Domain | FE entry | API | Store |
|---|---|---|---|
| Auth | SignIn | `/api/v1/auth/*` | `users`, roles, permissions |
| Admissions | PRM layout | `/api/v1/admissions/*` | students, parents, related |
| Academics | Teacher/Coordinator/Admin | attendance, lesson-plans, exams, `/academics/*` | SQL + academics collections |
| Finance | AccountHead + Parent/Student fees | `/api/v1/finance/*` | finance state / actions |
| HR | HR layout | `/api/v1/hr/*` | HR employees/collections + user provision |
| Front office / passes | Admin/PRM/Gate | `/api/v1/front-office/*` | `FrontOfficeRecord` |
| Campus ops | Lib/TM/Driver/Gate/Stores/Canteen/IT/HK | `/api/v1/ops/{collection}` | `OpsRecord` JSON per campus |
| Campus audit | JD Audit / Process / Quality | `/api/v1/campus-audit/{collection}` | campus audit records |
| Files | uploads | `/api/v1/files/*` | disk `uploads/` + metadata |
| ProTrack | Track helpers | `/api/v1/protrack/*` | none (external) |
| Notify | — | called from services | demo outbox or provider |

**API client inventory:** 35 `src/services/*Api.js` modules plus `apiClient.js`, `opsApi.js`, `campusAuditApi.js`, `protrackApi.js`, `campusJsonStore.js`.

---

## 6. Cross-module workflow and persistence results

| Workflow | Result | Evidence class |
|---|---|---|
| Parent pay → student sees same balance | `PASS` | Prior browser + pytest |
| HR create role → login → save ops row → re-login | `PASS` | Pytest `test_department_roles_persist_their_own_records` |
| Teacher cannot write ops collections | `PASS` | Same suite |
| Driver cannot see other vehicles | `PASS` | Pytest |
| Gatekeeper read passes / deny write & transfers | `PASS` | Pytest; prior browser after uvicorn reload |
| TM dropdowns use campus rows not sample constants | `PARTIAL` | Prior browser |
| Canteen order save | `FAIL` | Code/UI success without confirmed API write |
| Enrollment → email notice | `PARTIAL` | Hook in WT; `NOT_CONFIGURED` |
| Track Bus live | `BLOCKED` | Empty ProTrack config |
| Star ratings shared across users | `FAIL` / `NOT IMPLEMENTED` | localStorage only |

**API mode seed policy:** Working-tree guidance and remaining-modules report: empty collections are **not** re-seeded from sample catalogues when API mode is on. Pre-existing rows (including older samples) remain.

---

## 7. Security and permission findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-01 | High (if live GPS enabled) | `useProtrackLive` falls back to `devicesList[0]` when plate/IMEI missing — wrong bus possible | `FAIL` (latent until tracking enabled) |
| S-02 | Medium | Parent/student full ledger previously reachable; mitigated by finance ACL requiring write/collect for campus state | `PASS` (tests) |
| S-03 | Medium | Multi-campus isolation assumed via `campus_id`; no adversarial cross-campus suite run this audit | `NOT TESTED` |
| S-04 | Low | Admin UI cannot create all roles — by design; risk is operational confusion, not privilege escalation | Documented |
| S-05 | Medium | Secrets for SMTP/WA/ProTrack must stay in server `.env`; FE must not embed them — pattern OK; values currently empty | `PASS` pattern / `BLOCKED` live |
| S-06 | Medium | Gatekeeper FO ACL depends on running API process loading current code (stale uvicorn caused 403 earlier) | Ops risk |
| S-07 | Low–Med | JWT + `must_change_password` gate in `deps.get_current_user` | Structure `PASS`; abuse tests `NOT TESTED` this pass |
| S-08 | Medium | Driver/parent/student data scoping present for fees and driver vehicles; exhaustive portal IDOR matrix `NOT TESTED` | `PARTIAL` |

No permissions were bypassed to force a green result.

---

## 8. Broken navigation, buttons, forms and reports

| Item | Status | Notes |
|---|---|---|
| Role URL bounce (cross-role URL) | `PASS` (prior) | IT→stationery → IT home |
| Canteen Add Order “Order Saved” | `FAIL` | Modal success without durable save confirmation |
| Receipt / payslip PDF download | Mock toast | Not a live report service |
| Payment link / gateway checkout copy | Mock | Excluded |
| IT dashboard ticket counts | `PARTIAL` | May still describe browser-local store |
| Track Bus | `BLOCKED` | Demo geometry when live GPS absent |
| Blank/error/permission empty states | `PARTIAL` | Gate 403 messaging improved when API denies; not audited on every page |
| Librarian Add Book route (historical) | Fixed in WT | Was falling through to dashboard |

---

## 9. Automated test and production build results

Executed **23 October 2026** during this audit (no tests deleted or weakened):

```
backend> python -m pytest tests/ -q
460 passed, 1 warning in 227.41s
```

```
repo> npm run build
✓ built in 45.29s
```

Warning: Starlette TestClient / httpx deprecation (environment), not a product defect.

**Browser:** Not re-run as a full matrix in this audit. Prior 23 Oct browser evidence is cited as `PARTIAL`/`BLOCKED` only.

---

## 10. Prioritized defect list

| Pri | Severity | Defect | Impact | Recommended fix |
|---|---|---|---|---|
| P0 | High | ProTrack first-device fallback (`devicesList[0]`) | Wrong bus if live tracking ever enabled | Require explicit IMEI/plate match; error if none |
| P0 | High | Canteen orders success without save | False operational confidence | Wire Add Order to `/ops/canteen-orders` before success UI |
| P1 | High | ProTrack + SMTP/WA not configured | No live GPS/notifications | Client supplies secrets; then re-verify (no commit of secrets) |
| P1 | Medium | Incomplete browser re-login matrix (HK, audit, driver duty, expenses, tickets, stock issue) | Unknown regressions | Finish role walkthroughs; mark PASS only with refresh+re-login |
| P1 | Medium | TM vehicle collection may hold only one vehicle after earlier wipe | Lost fleet rows | Authorized restore or re-enter; prevent empty-cache replace |
| P2 | Medium | Star ratings localStorage SoT | Not multi-user | Optional `staff_ratings` API (approval required) |
| P2 | Medium | Gateway/PDF mocked | Finance desk UX | Leave until school approves gateway project (excluded now) |
| P2 | Low | Large FE chunks / FE SoT islands | Maintainability | Gradual cutover; not blocking if API flags on |
| P3 | Low | Stale uvicorn without reload | False 403s in local dev | Document reload procedure |

---

## 11. Browser verification evidence

| Source | Coverage |
|---|---|
| This audit | **No new browser matrix** — structure + automated only |
| `REMAINING_MODULES_IMPLEMENTATION_REPORT.md` (23 Oct) | Parent fee checkout refresh+re-login; student same balance; TM vehicle/route/duty; driver vehicle/health; gate visitor/passes; stores pencil; canteen lemon rice; IT projector; HK schedule; audit assignment; librarian Atlas; role bounce |

Those browser items remain **`PARTIAL`**, not upgraded.

---

## 12. Remaining blockers and client dependencies

1. **ProTrack365:** Populate `PROTRACK_ADMIN_*` and `PROTRACK_PARENT_*`; confirm IMEI for plate `TN58BB3769`; remove FE first-device fallback before enabling Track Bus.  
2. **SMTP / WhatsApp:** School app password + provider token outside Git; then LIVE_VERIFIED separately.  
3. **Payment gateway:** Out of scope; remains mocked.  
4. **Data repair:** Confirm whether wiped transport vehicles should be restored (authorization required).  
5. **Sign-off walkthrough:** Super Admin, Admin, Director, Principal, Coordinator, full Account Head, and remaining ops clicks still `NOT TESTED` in this audit.  
6. **No Hostel Warden / Admission Officer** unless newly approved.

---

## Appendix A — Role coverage matrix (this audit)

| Role | Code/API mapped | Automated tests | Browser (prior / this) | Overall |
|---|---|---|---|---|
| Super Admin | Yes | Indirect | This: `NOT TESTED` | `NOT TESTED` |
| Admin | Yes | Users API | This: `NOT TESTED` | `PARTIAL` |
| PRM | Yes | Admissions suite | This: `NOT TESTED` | `PARTIAL` |
| Director / Principal | Yes | Partial | Star ratings FE; panels `NOT TESTED` | `PARTIAL` |
| Coordinator / Teacher | Yes | Attendance/exams/leave suites | This: `NOT TESTED` | `PARTIAL` |
| Student / Parent | Yes | Fee scoping tests | Prior browser fees | `PARTIAL` |
| HR | Yes | Staff provision tests | This: `NOT TESTED` | `PARTIAL` |
| Account Head / Finance Assistant | Yes | Finance suite | This: `NOT TESTED` | `PARTIAL` |
| Transport Manager | Yes | Ops persistence | Prior browser | `PARTIAL` |
| Driver | Yes | Scope tests | Prior browser | `PARTIAL` |
| Gatekeeper / GKM | Yes | FO gate tests | Prior browser | `PARTIAL` |
| Librarian | Yes | Ops tests | Prior browser | `PARTIAL` |
| Stores / Canteen / IT / HK | Yes | Ops tests | Prior browser; canteen orders `FAIL` | `PARTIAL`/`FAIL` |
| JD Audit / Process / Quality | Yes | Campus-audit tests | Prior assign browser | `PARTIAL` |

---

## Appendix B — What this audit did **not** do

- Did not rewrite application modules.  
- Did not send live email/WhatsApp or call ProTrack with credentials.  
- Did not enable live tracking or change payment processing.  
- Did not commit, push, deploy, or discard local changes.  
- Did not mark any module `COMPLETE` based on page existence or API tests alone.

---

## Appendix C — Next recommended implementation order

1. **Fix P0 canteen order persistence** and **remove ProTrack `devicesList[0]` fallback**.  
2. Finish **browser re-login matrix** for open ops/audit/parent menus; update `REMAINING_MODULES_IMPLEMENTATION_REPORT.md` only with new evidence.  
3. Client configures **SMTP/WA** and **ProTrack**; re-run connectivity audits; only then consider Track Bus enablement (separate approval).  
4. Optional: Super Admin / Admin / Director / Principal structured panel audit.  
5. Optional (approval): star-ratings REST; gateway project.

---

*End of audit report.*
