# QMIS ERP — Academic workflow gap-fix report

| Field | Value |
|---|---|
| **Date** | 29 October 2026 |
| **Basis** | `docs/QMIS_End_to_End_Academic_Examination_Results_Audit.md` |
| **Scope** | Confirmed gaps only; no commit / push / deploy; no production writes |
| **Active verification target** | Vite `:5173` → API `:8000` → local Postgres `qmis_erp` |
| **Prior isolated UAT** | SQLite API `:8001` (left running; **not** restarted or modified this pass) |

---

## Phase 1 — Environment verification (`:5173` → `:8000`)

| Check | Result | Evidence |
|---|---|---|
| Frontend API base | **PASS** | Root `.env` and `.env.local`: `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`. `src/services/apiClient.js` defaults to the same. |
| Browser hits `:8000` | **PASS** | Principal login resource `http://127.0.0.1:8000/api/v1/auth/login`; Mark Entry / parent calls also to `:8000`. |
| API health | **PASS** | `GET http://127.0.0.1:8000/health` → `{"status":"ok"}` (mounted at `/health`, not `/api/v1/health`). `/docs` → 200. |
| Settings DB identity | **PASS** | `settings.database_url` → host `localhost`, port `5432`, database `qmis_erp`, driver `postgresql+psycopg`, localhost-only. |
| Direct DB connect (new client) | **BLOCKED (ops)** | `FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute`. Side scripts cannot open new pools while `:8000` + `:8001` hold slots. |
| Live API ↔ DB | **PASS** | Login / exams / marks-batches served from running `:8000` pool despite new-connection exhaustion. |
| `exams.schedule` schema | **PASS (functional)** | ORM/API read-write of schedule JSON via flattened `section` / `teacherName` / `timelines`. PUT+GET on draft `ZZ DEL Exam` persisted `TL-UAT-PROBE-1`. Seeded `PG8000 UAT Midterm G6` reloaded with year `2026 - 2027`, section A, Maths timeline. |
| Alembic version table | **NOT READ** | Blocked by connection-slot exhaustion for new SQL clients. Do not treat as schema failure; schedule behaviour proves column present. |
| `:8001` | **UNTOUCHED** | Still listening; not used for this verification. |

**Verdict:** Active configuration is consistent for `:5173`→`:8000`/Postgres. Do **not** silently switch ports. Ops should free Postgres slots (idle apps) before future direct `alembic`/inspector scripts; API UAT can continue via HTTP.

---

## Implementation plan (executed earlier + this pass)

1. Migration consistency (docs + schedule round-trip test).  
2. Admission approval: **no new FSM** (stated SOP has none).  
3. Marks association: require placement + class/section match.  
4. Teacher correction UI wired to existing API.  
5. Notify isolation + optional email/WhatsApp via existing `notify_event`.  
6. Focused pytest + frontend build.  
7. Isolated `:8001` browser UAT (prior).  
8. **This pass:** Phase 1 on `:8000`, Postgres browser/API UAT, regression, report update. **No new workflow code fixes** (defects found were data/ops).

---

## Gap-by-gap results

### 1) `exams.schedule` migration consistency — **DONE (ops + test)**

| Item | Detail |
|---|---|
| Migration | Existing `0022_exam_schedule_json` (JSON nullable); no duplicate migration |
| Docs | `backend/docs/FRONTEND_INTEGRATION.md` — require `0022` / `schedule` before Mark Entry UAT |
| Test | `tests/test_exam_schedule_and_marks_association.py::test_exam_schedule_timelines_round_trip` |
| Local Postgres | Previously upgraded to head on 29 Oct. This session: functional schedule persist on `:8000`; direct alembic inspect blocked by slots |
| Production | **Not modified.** Any remote/prod env still on ≤`0021` must run `alembic upgrade head` after backup |

### 2) Admission approval — **DECISION: not required by stated SOP**

| Item | Detail |
|---|---|
| Decision | Expected workflow is Enquiry → Admission → Enrolment (no separate admit approve). Existing `admissions.write` enroll preserved |
| Change | No new roles/chains |
| Test | `test_teacher_cannot_enroll_admission` (403) |
| Remaining | If partner SOP later mandates Principal/Director admit sign-off, add the smallest approval stage then — **do not invent now** |

### 3) Marks-to-student association — **DONE**

| Item | Detail |
|---|---|
| Implementation | `_apply_entries` requires `placement_status=placed`, normalized class match, and section match when batch has a section; rejects unknown/duplicate student IDs |
| Frontend | Mark Entry loads only placed students with matching section |
| Preserved | Historical published rows untouched; no data remap migration |
| Year labels | Equivalence via `academic_year_labels.academic_years_equivalent` (see § Academic-year matching) |
| Tests | Association suite + updated helpers to place students |
| Postgres UAT | Unplaced marks → **400**; Mark Entry UI listed **Placed Pg8000Uat** only after class-teacher assignment |

### 4) Teacher marks correction UI — **DONE**

| Item | Detail |
|---|---|
| Implementation | Mark Entry: **Request correction** → edit → reason modal → `requestMarksCorrectionApi` |
| Approvals | Still Principal → Director (`marks_correction`); cannot bypass for initial publish |
| Teacher create exam | Clear 403 messaging + UI notice that `exams.write` belongs to Principal/Coordinator |
| Tests | `test_marks_correction_phase6.py` + Postgres API correction chain |
| Browser | Correction **API** path on `:8000` (201 → teacher decide 403 → Principal 200 → Director 200). UI button still limited when masters subject list lacks `Maths` (only `English` present on this campus) |

### 5) Result notifications — **DONE (isolation + optional channels)**

| Item | Detail |
|---|---|
| Isolation | Final marks approve **commits first**; parent notify runs after; exceptions are logged and **do not** undo publication |
| Channels | In-app `result_published` retained; best-effort email/WhatsApp via `notify_event` |
| Tests | `test_result_notify_isolation.py` (mocked outage); phase7 in-app notify |
| Browser / API | Parent Exam Result + dashboard showed published Maths **43/50** after correction |

---

## Academic-year matching

### Where labels appear

| Source | Typical format |
|---|---|
| Seed / masters `AcademicYear.name` | `2026-27` |
| Mark Entry offline defaults / exam create UI | `2026 - 2027` |
| `Exam.academic_year` | Whatever the client sent (display label preserved) |

### Decision implemented

Non-destructive **key equivalence** only:

- Module: `backend/app/services/academic_year_labels.py`
- Parses supported pairs: `2026-27`, `2026 - 2027`, `2026-2027`, en-dash variants → `(2026, 2027)`
- Rejects marks only when **both** exam label and student `AcademicYear.name` parse **and** keys differ
- Unrecognised labels (`FY 2026-27`, bare `2026`, empty) → **no year rejection** (do not invent)
- **Does not rewrite** stored exam or masters year strings

### Tests

- `tests/test_academic_year_labels.py` — supported / different / invalid-ambiguous  
- `test_exam_year_label_formats_are_equivalent_for_marks` — exam `2026 - 2027` with seeded student year still accepts marks  

### Remaining product decision (not guessed)

Whether exams must **always** carry a year label that maps 1:1 to `AcademicYear` FK (instead of optional display string). Current model stays label-based. **No further normalization rules invented this pass.**

---

## Browser / API UAT — Postgres `:8000` (this pass)

**Environment:** Vite `:5173` → `http://127.0.0.1:8000/api/v1`; DB `qmis_erp@localhost:5432`.  
**Dedicated records:** `Pending/Placed Pg8000Uat`, exam `PG8000 UAT Midterm G6`, parents `pg8000.uat.*.parent@example.com`.  
**Artifacts:** `backend/local/uat/_pg8000_browser_uat_seed.json`, `_pg8000_browser_uat_seed_retry.py`, `_pg8000_pytest_out.txt`.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Student placement / class-section match | **PASS** | Pending in `pending-placement`; placed student `b66eba93-…` Grade 6-A Roll 1. Parent dashboard: `Grade 6 - A · Roll No. 1`. |
| 2 | Teacher allocation (roster) | **PASS (ops + verify)** | Initial Mark Entry load showed **0** students because Grade 6-A had no class teacher. After `PATCH /masters/sections/{id}` set `class_teacher_user_id` → `teacher@qmis.edu`, teacher `GET /students?className=Grade 6` returned Pending + Placed. |
| 3 | Exam create + schedule save/reload | **PASS** | API create retained year/section/timelines (`scheduleSaveReload.match=true`). Browser Principal list + modal: **PG8000 UAT Midterm G6**, Grade 6 · A, Published/Approved. |
| 4 | Marks: placed OK / unplaced rejected | **PASS** | Unplaced batch create **400** (`…must be section-placed…`). Placed published. Browser Mark Entry table: **Placed Pg8000Uat only** (not Pending). |
| 5 | Teacher correction + Principal → Director | **PASS (API)** | Correction 201; teacher decide **403**; Principal **200**; Director **200**; version 2 marks **43**. |
| 6 | Results publication + parent visibility | **PASS (browser)** | Parent Exam Result: PG8000 / Maths / **43**/50 / 86%. Dashboard highest mark Maths · PG8000. Other child results **404**. |
| 7 | Notify failure does not undo publish | **PASS (pytest)** | `test_result_notify_isolation` — remote uvicorn not monkeypatched. |
| 8 | Role / unauthorized protection | **PASS** | Teacher create exam **403**; teacher correction decide **403**; parent URL `/principal/examination-timetable` stayed on **parent** portal (dashboard). |

**Not claimed as browser-passed:** full click-path of Teacher **Request correction** (masters subject list on this campus is only `English`; published batch subject is `Maths`). API correction verified instead.

**Phase 3:** No reproducible workflow code defect requiring a patch this pass. Class-teacher assignment was test-data/ops. Subject masters coverage remains a product/config gap.

---

## Browser UAT results — prior isolated `:8001` (reference)

**Environment:** isolated SQLite `module12_browser_uat.sqlite` on `:8001`; Vite briefly pointed at `:8001` during that pass. Seed/evidence: `backend/local/uat/_browser_uat_gap_seed.json`, `_browser_uat_api_evidence.json`.

| # | Check | Result |
|---|---|---|
| 1–10 | Placement, association, correction API, parent results, schedule, notify isolation | **PASS** (see prior table in git history / earlier report body) |

---

## Files changed (gap implementation; unchanged this verification pass)

| Area | Paths |
|---|---|
| Backend | `app/services/exams.py`, `app/services/approvals.py`, `app/services/academic_year_labels.py` (**new**) |
| Tests | `test_academic_year_labels.py` (new), `test_exam_schedule_and_marks_association.py`, `test_result_notify_isolation.py`, `test_exams.py`, `test_results_phase3.py` |
| Frontend | `MarkEntryPage.jsx`, `markEntryStatus.js`, `CreateExamSchedule.jsx`, `AddExamSchedule.jsx`, `createExamScheduleData.js` |
| Docs | `backend/docs/FRONTEND_INTEGRATION.md`, this report |
| Local UAT helpers | `backend/local/uat/_pg8000_browser_uat_*.py/json` (Postgres `:8000`); prior `_browser_uat_*` for `:8001` |

---

## Automated verification (this pass)

| Suite | Result |
|---|---|
| `test_exam_schedule_and_marks_association.py` + `test_academic_year_labels.py` + `test_result_notify_isolation.py` + `test_marks_correction_phase6.py` (`--import-mode=importlib`) | **11 passed** |
| Frontend `npm run build` | **PASS** (exit 0) |
| Full-suite unrelated failures (morning of 29 Oct) | 9 failures — **not re-run** this UAT |

---

## Closure pass — connection / subjects / correction UI / Alembic (evening)

Evidence: `backend/local/uat/_pg8000_closure_evidence.json`, `_pg8000_correction_ui_prep.json`.

### 1) Connection-slot diagnostics (read-only) — **ROOT CAUSE IDENTIFIED; NOT CLEARED**

| Finding | Detail |
|---|---|
| Postgres limits | `max_connections=100`, `superuser_reserved_connections=3` |
| Primary owner | **pgAdmin 4** (`pgAdmin4.py`) held **≈90–92** TCP connections to `:5432` as role `postgres` (many `pgAdmin 4 - CONN:*` rows in `pg_stat_activity`) |
| App `:8000` | Uvicorn reload worker held **5** connections as `qmis_app` (SQLAlchemy default `QueuePool` size 5) — expected |
| App `:8001` | **0** Postgres connections (isolated SQLite) — not the cause; **not modified** |
| Session cleanup | `get_db()` creates `SessionLocal`, `yield`s, **`db.close()` in `finally`** — no leak found in application code |
| Actions taken | **None.** Did not terminate sessions, change limits, reset DB, or restart services (requires explicit approval) |
| Blocker | Ops approval needed to close idle pgAdmin query tools / quit pgAdmin before slots are reliably free |

### 2) Subject masters — **NO ARBITRARY INSERT**

| Finding | Detail |
|---|---|
| Campus masters | Only `ENG` / **English** |
| Approved seed defaults (`masters_service.DEFAULT_SUBJECTS`) | Includes `MAT` / **Mathematics** (not `Maths`), plus Science, etc. Seed runs only when subject count is **0**, so English-only campus never received the rest |
| Prior UAT marks subject | Free-text **`Maths`** on batches/timelines (not FK to masters) |
| Decision | **Did not** create `Maths` or `Mathematics`. Used existing **English** for correction-UI test. Restoring `MAT/Mathematics` remains an Admin curriculum decision (`POST /masters/subjects` / Admin → Subjects), not a UAT invent |

### 3) Correction-UI browser test — **TEACHER UI PASS; PRINCIPAL/DIRECTOR DECIDE VIA API**

Dedicated English batch on exam `PG8000 UAT Midterm G6` (placed student only); Maths **43** left untouched.

| Step | Result | Evidence |
|---|---|---|
| Publish English v1 (API prep) | **PASS** | Batch `cef0433a-…` published marks **38** |
| Teacher UI Request correction | **PASS** | Load English → **Request correction** → edit **38→40** → reason modal → **Submit correction** → UI **Pending Principal Approval** |
| Teacher UI final status after submit | **PASS** | Message: waiting for Principal; v2 batch `1a7babac-…` `status=submitted` `awaitingRole=principal` |
| Principal Mark Entry Approval UI | **PARTIAL** | First navigation showed **Failed to fetch** (connection pressure). Retry later listed English correction rows |
| Principal → Director decide | **PASS (API)** | Principal approve **200**, Director approve **200**; v2 **published** marks **40**. Maths batch still **43** |
| Director Mark Entry Approval UI decide click | **NOT CLAIMED** | Decide path completed via API after Principal UI fetch failure mid-flow |

### 4) Alembic / migration readiness — **LOCAL CONFIRMED**

| Check | Result |
|---|---|
| Local `alembic_version` | **`0023_attendance_dual_session`** (read via NullPool once a slot was available) |
| `exams.schedule` | Present: `data_type=json`, `is_nullable=YES` (from `0022`) |
| Production | **Not migrated.** Any remote/prod still ≤`0021` still needs a **scheduled** `alembic upgrade head` after backup — **out of scope for local UAT** |

---

## Sign-off recommendation

**UAT substantially passed — pending environment risk clearance and Principal/Director approval-UI decide clicks.**

Core academic workflow (placement gate, schedule persist, marks association, API correction chain, parent visibility, RBAC, Teacher correction UI) has strong evidence on `:5173`→`:8000`/Postgres. Do **not** treat as full production sign-off until:

1. pgAdmin (or equivalent) connection leak is cleared with ops approval, and  
2. Principal → Director **approve buttons** are exercised in the browser without `Failed to fetch`, and  
3. Production migration readiness is scheduled separately (local already at `0023`).

---

## Outstanding risks / blockers

1. **pgAdmin connection exhaustion** — primary local blocker; app pool itself is healthy (5). Needs ops approval to close pgAdmin / idle tools. Do not raise `max_connections` without cause review.  
2. **Production / remote DBs** may still need `alembic upgrade head` for `exams.schedule` — confirm per environment; **not run** from this UAT. Local is at `0023`.  
3. **Subject naming** — campus masters lack `Mathematics`; historical batches used free-text `Maths`. Product/Admin should decide whether to restore `DEFAULT_SUBJECTS` (`MAT`/`Mathematics`) via approved subject create.  
4. **Mark Entry roster** still requires class-teacher / Teacher Allocation.  
5. **Parent first login** requires password change before `results.read`.  
6. **Vite CORS** allows `:5173` only by default.  
7. Optional **Exam.academic_year → AcademicYear FK** still a product decision.  
8. Email/WhatsApp live delivery still depends on configured providers.
