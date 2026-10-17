# Testing report

Project: Queen Mira International School ERP  
Last run: 17 October 2026 — **Phase 3 Ops + Audit closeout (Biometric last)**

## Suite / build

| Check | Result |
|---|---|
| `pytest tests/test_ops_and_audit_collections.py` | **5 passed** |
| `pytest tests/test_academics_collections.py` | **4 passed** |
| Combined (this pass) | **9 passed** |
| Prior full suite (16 Oct) | **426 passed** |
| Frontend build | Not re-run this pass (data-layer + API) |

## Status sheet

| Check | Result |
|---|---|
| TOTAL | **480 Completed / 0 Partial / 0 Not Completed / 0 Gap** (of 480) |
| Ops + Audit | Closed via `/ops` + `/campus-audit` collections (Alembic **0014**) |
| Biometric | Teacher/Coordinator → `ops/biometric-attendance` (simulated ESSL sync) |

## Local stack (this Mac)

| Item | Value |
|---|---|
| Postgres | **18.6** EnterpriseDB on **5433** (`qmis_erp`, user `postgres`) |
| API | `./run-local.sh` → http://127.0.0.1:8000 |
| Frontend | `npm run dev` → http://localhost:5173 |
| Migration | `alembic upgrade head` → **0014_ops_and_audit_records** |

## Smoke notes

- Library / Gate registers / Transport vehicles / Canteen menu / JD Audit templates / Process observations hydrate from campus JSON SoT when API auth is on.
- Demo `localStorage` keys mapped in `campusCollectionRegistry.js` are purged after hydrate.
- Live RFID/eSSL device contact is still simulated; punches persist in Postgres.
