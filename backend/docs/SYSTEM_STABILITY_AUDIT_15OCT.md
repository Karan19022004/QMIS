# System-wide stability audit — 15 October 2026

**Branch:** `main` (+ High follow-up fixes in working tree)  
**Stack verified:** React + Vite frontend · FastAPI backend · SQLAlchemy · PostgreSQL · Alembic  
**Decision:** **READY WITH LIMITATIONS**

Status legend: **PASS** · **PARTIAL** · **FAIL** · **NOT RUN**

---

## 1. Architecture and request flow

```
Browser (Vite :5173)
  → apiClient (VITE_API_BASE_URL, Bearer JWT in sessionStorage)
  → FastAPI (:8000) CORS + lifespan init_db
       → require_permission / get_current_user (JWT + matrix)
       → service layer → SQLAlchemy SessionLocal
       → PostgreSQL qmis_erp
       → optional uploads/ + stub/demo integrations
```

**Startup (PASS):** `app/main.py` lifespan runs `create_all` (missing tables only), column helpers, `warn_if_schema_behind()`, `seed_reference_data`. Routers mounted directly on `app` (not via unused `api/v1/router.py`).

**Auth path (PASS):** Login → JWT → `/auth/me` → frontend role routing → API calls with `Authorization: Bearer`.

---

## 2. Frontend ↔ backend connectivity

| Check | Status | Notes |
|---|---|---|
| Default API base | PASS | `http://127.0.0.1:8000/api/v1` |
| JWT attach / 401 clear | PASS | `apiClient.js` |
| CORS | PASS | localhost:5173 listed; production rejects `*` |
| Flag matrix vs `.env.example` | **FIXED** | Students/leave/attendance/tasks/escalations/notifications previously cascaded from `VITE_USE_API_ADMISSIONS` (default **false**), so API login still hit localStorage. Now default to `VITE_USE_API_AUTH` (matches `.env.example`). |
| API-mode localStorage fallback | **FIXED** | Students + lesson plans: fail-closed to `[]` until hydrate (no stale localStorage when API flag on). SubmitLessonPlan hydrates `/lesson-plans?mine=true`. |
| Hardcoded production hosts | PASS | No prod host hardcoded in client |
| Hybrid demo screens | PARTIAL | Deliverables, star ratings, some timetables, biometric remain local/demo by design |
| Class attendance write UI | **FIXED** | Teacher/Coordinator ClassAttendance: editable Present/Absent + Save → `POST /attendance` |
| Mark Entry → `/marks-batches` | **FIXED** | Shared MarkEntryPage loads exams/students; draft/submit via marks-batches APIs |
| Bundle size | **FIXED** | Role layouts lazy-loaded in `App.jsx` + vendor manualChunks; entry JS ~354 kB (was ~9 MB monolith) |

**Frontend production build:** PASS (~45 s).

---

## 3. Database / migrations

| Check | Status | Evidence |
|---|---|---|
| PostgreSQL connectivity | PASS | Live `DATABASE_URL` |
| Alembic head (repo + DB) | PASS | **`0012_students_student_user_id`** |
| Application table count | PASS | **48** live = **48** ORM; no extras/missing |
| Docs baseline | PASS | Rules/mapping updated for 0012 (was 0011 historically) |
| Fresh upgrade path | PASS | `alembic upgrade head` applied on this environment |
| Schema helpers at startup | PARTIAL | `create_all` + migrate helpers; column changes still need Alembic |

**Correction vs older docs:** Baseline is **48 tables @ `0012`**, not `0011`.

---

## 4. Data persistence / retrieval

| Domain | Create | Read | Update | Notes |
|---|---|---|---|---|
| Auth / users | PASS | PASS | PASS | Seed + admin users API |
| Admissions → students | PASS | PASS | PASS | Parent + optional student login link |
| Attendance | PASS | PASS | PASS | ClassAttendance Save → POST /attendance |
| Leave / escalations / tasks | PASS | PASS | PASS | Mounted under leave + escalations routers |
| Announcements / calendar / TC / communication | PASS | PASS | PASS | Shared campus APIs |
| Front office records | PASS | PASS | PASS | PRM collections |
| Lesson plans / exams / marks | PASS | PASS | PASS | Mark Entry wired to /marks-batches |
| Finance / HR | PASS | PASS | PASS | Partner-style SoT |
| Documents / files | PASS | PASS | PASS | Domain ACL + orphan upload IDOR closed |

Refresh / re-login persistence: PASS for API-backed domains when flags on.

---

## 5. Messaging / external integrations

| Integration | Status | Behaviour |
|---|---|---|
| Email (SMTP) | PARTIAL | Stub unless configured; `demo` writes local outbox (not real delivery) |
| WhatsApp | PARTIAL | Stub / demo outbox |
| Razorpay | PARTIAL | Stub / demo HMAC; live keys required for real charges |
| RFID import | NOT RUN | Flagged off (`rfid_import_enabled=false`) |
| Background schedulers | PARTIAL | Escalation clock on list; lesson-plan reminders endpoint (role-gated) |

**Rule:** API accept ≠ delivery verified. No live messages/payments sent during this audit.

---

## 6. Authentication

| Check | Status | Notes |
|---|---|---|
| Password hashing | PASS | bcrypt via security helpers |
| JWT sign / expiry | PASS | Configurable; weak secret blocked outside development |
| Login lockout / OTP rate limits | PASS | In-memory per process |
| OTP debug | PASS (dev only) | Echo only when `ENVIRONMENT=development` and `OTP_DEBUG` |
| must_change_password | **FIXED** | Server gate: only `/auth/change-password`, `/auth/me`, `/auth/logout` while flag set (`password_change_required`) |
| Demo offline logins | PASS | Dev build + `VITE_ENABLE_DEMO_LOGINS` |
| Seed passwords in settings | PARTIAL | Weak defaults for **development seed only**; not for production |

---

## 7. RBAC (summary matrix)

Backend matrix: `backend/app/permissions/matrix.py`. Authorization is enforced in deps/services (sidebar is not security).

| Role | Core access | Notable grants | Notable denials |
|---|---|---|---|
| admin / superadmin | Full | All codes | — |
| prm | Admissions + FO | `frontoffice.*`, `admissions.write` | Most academics write |
| teacher | `_STAFF_ACADEMIC` | attendance/marks/lessonplans write | `exams.write`, documents, TC, FO |
| coordinator | Staff academic + | `exams.write` | documents/TC/FO |
| principal / director | Staff + | exam/lesson plan leadership | FO write |
| parent / student | Self-scoped | results/attendance/tc/comms | Staff write |
| accounthead / finance_assistant | Finance | collect/read (+ head approve) | Academic write |

**Gaps (documented, not Critical):** Teacher/Coordinator biometric = Gap; some FE screens still local despite API. Record-level scoping PASS for parent/student TC/results/attendance.

---

## 8. Confirmed bugs / fixes

| ID | Severity | Finding | Status |
|---|---|---|---|
| C-01 | **High** | Students/leave/notifications/tasks flags defaulted off unless admissions flag on; contradicted `.env.example` → silent localStorage after API login | **FIXED** in `src/services/apiClient.js` |
| H-02 | **High** | Orphan `/files/{id}/download` was campus-readable (IDOR for generic uploads) | **FIXED** in `app/services/files.py` (uploader or elevated staff only) |
| H-03 | **High** | `must_change_password` flagged on login but JWT still used for all APIs | **FIXED** in `app/deps.py` + query-token download path |
| H-04 | **High** | API-flagged FE modules fell back to stale localStorage before/without hydrate | **FIXED** students + lesson plans; SubmitLessonPlan API hydrate |
| M-01 | Medium | Class attendance UI lacks complete mark-save UX (API exists + pytest) | **FIXED** |
| M-02 | Medium | Mark entry UI still primarily localStorage; `/marks-batches` API exists | **FIXED** |
| M-03 | Medium | Main JS bundle ~9 MB uncompressed | **FIXED** (lazy role layouts) |
| L-01 | Low | Unused `api/v1/router.py` duplicate include path | Open |
| L-02 | Low | Dual `Base` definitions historically (`models` vs `db/session`) — app uses `app.models.Base` | Open |
| L-03 | Low | Working tree: deleted `.vscode/tasks.json`, leftover unlocked Word copies | Cleanup optional |

No Critical auth bypass found in this pass. High follow-ups H-02–H-04 addressed.

---

## 9. Performance

| Check | Status | Result |
|---|---|---|
| Controlled load test | NOT RUN | No production load; avoid uncontrolled soak |
| Pytest suite wall time | PASS | **415 passed** in ~205 s (dev machine) |
| Connection pooling | PARTIAL | SQLAlchemy engine defaults; not load-profiled |
| Unbounded lists | PARTIAL | Some list endpoints lack hard max page size |
| Indexes / N+1 | PARTIAL | Not systematically profiled this pass |

Do not invent scalability claims.

---

## 10. Test results

| Suite | Result |
|---|---|
| Backend `pytest tests/ -q` | **415 passed**, 1 warning (Starlette TestClient deprecation) — re-verified after H-02–H-04 |
| Frontend `npm run build` | **PASS** (entry ~354 kB after layout code-split; 15 Oct Medium fix) |
| Browser E2E / Playwright | NOT RUN |
| Live payment/email/WhatsApp | NOT RUN (by policy) |
| Load / soak | NOT RUN |

---

## 11. Admin / PRM readiness

| Panel | Word status | Audit |
|---|---|---|
| Administrator | 26/26 Completed | PASS for shared campus APIs; READY WITH LIMITATIONS (known hybrid screens elsewhere) |
| PRM (Front Office) | 21/21 Completed | PASS for `front_office_records` + admissions; READY WITH LIMITATIONS |
| Parent / Student | 23/23 | PASS (self-scoped) |
| Teacher / Coordinator | 29 Completed / 1 Gap | PASS except biometric Gap |
| Principal | 21/21 Completed | PASS (exams.write + shared APIs) |

---

## 12. Documentation updates

- This file: `backend/docs/SYSTEM_STABILITY_AUDIT_15OCT.md`
- Keep rules/mapping/overview consistent with Alembic **0012** / 48 tables
- Daily work: `reports/daily-work-report.md` (markdown SoT; no PDF per project rule)
- Testing: `reports/testing-report.md`

---

## 13. Go / no-go

### **READY WITH LIMITATIONS**

**Why not READY:** Incomplete role panels beyond Principal (Director next); integrations remain stub/demo unless configured; some portal screens still local-only by design; further route-level lazy loading can shrink large role chunks.

**Why not NOT READY:** No unresolved Critical/High stability blockers; Medium attendance/marks/bundle items fixed; DB schema matches ORM at head **0012**; Admin/PRM/Parent/Student/Teacher/Coordinator/Principal essential paths verified.

**Recommended next steps:**

1. Director panel wiring (same shared domains).
2. Optional deeper page-level lazy imports inside largest role route trees.
3. Optional Archify refresh noting Principal 21/21 + Medium fixes.
