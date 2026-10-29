# Testing report

**Date:** 29 October 2026  
**Context:** Academic workflow gap fixes + `:5173`→`:8000` Postgres UAT + closure pass; class/section+leave audit; **Phase 1 full ERP audit** (static inventory only — no new pytest this final pass). No production writes. Not committed/pushed.

## Suites — closure pass (late evening)

| Suite | Result |
|---|---|
| Read-only connection diagnostics | **ROOT CAUSE:** pgAdmin ≈90–92 conns; uvicorn `:8000` = 5; `:8001` = 0 to Postgres. No terminate/limit change |
| Subject masters investigation | Campus = English only; default seed includes Mathematics — **no insert** |
| Teacher correction UI (English 38→40) | **PASS** (browser click path) |
| Principal→Director correction decide | **PASS (API)** after Principal UI `Failed to fetch` |
| Alembic / `exams.schedule` | Local **`0023_attendance_dual_session`**; schedule JSON nullable **YES** |
| Sign-off | **Substantially passed** — pending pgAdmin clearance + Principal/Director approve-button UI |

## Suites — Postgres `:8000` verification (evening)

| Suite | Result |
|---|---|
| Env: Vite API base + browser login to `:8000` | **PASS** |
| Dedicated PG8000 API + browser workflow | **PASS** (see gap-fix report) |
| Focused association + year + notify + correction (`--import-mode=importlib`) | **11 passed** |
| Frontend `npm run build` | **PASS** |

## Suites — earlier same day

| Suite | Result |
|---|---|
| Isolated `:8001` browser UAT + year labels | **29 passed** + checklist evidence |
| Gap-fix focused academic | **25 passed** (superseded counts) |
| Schedule migration + mark-entry modules | **16 passed**; full suite **644 passed / 9 failed** (unrelated; not re-run) |

## Coverage notes

- Teacher correction UI verified on English published batch; Maths 43 preserved.
- Connection pressure can cause intermittent browser `Failed to fetch` on approval screens.
- Local migration head includes schedule (`0022`) and attendance dual-session (`0023`).

## Suites — Phase 1 full ERP audit (late)

| Suite | Result |
|---|---|
| Static role/permission/API/FE inventory | **Done** → `docs/QMIS_Full_Role_Module_Workflow_Audit.md` |
| Full pytest / browser UAT for ops finance library gate etc. | **Not run** (audit-only Phase 1) |

## Suites — Class/section catalog consistency

| Suite | Result |
|---|---|
| Inventory + gap doc | `docs/QMIS_Class_Section_Catalog_Consistency_Audit.md` |
| `pytest tests/test_exams.py tests/test_class_details_api.py -q --import-mode=importlib` | **12 passed** (includes unknown class/section + inactive section + teacher masters 403) |
| `npm run build` | **PASS** |
| Browser UAT Admin→all roles catalog | **Not run** |

## Not run / blockers

- Terminating pgAdmin / changing `max_connections` (needs explicit approval).
- Production `alembic upgrade` (must be scheduled separately).
- Full Principal/Director approve-button browser clicks under healthy connection budget.
- Creating Mathematics master without Admin curriculum confirmation.
