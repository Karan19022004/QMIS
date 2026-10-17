# Testing report

Project: Queen Mira International School ERP  
Last run: 17 October 2026 — **Core Partials closed (Principal academics + HR)**

## Suite / build

| Check | Result |
|---|---|
| `pytest tests/test_academics_collections.py` | **4 passed** |
| Prior full suite (16 Oct) | **426 passed** |
| Frontend build | Not re-run this pass (data-layer + API only) |

## Status sheet

| Check | Result |
|---|---|
| TOTAL | **313 Completed / 0 Partial / 165 Not Completed / 2 Gap** (of 480) |
| Principal | **21 Completed** (Timetable + Teacher Allocation closed) |
| HR | **35 Completed** (Dashboard / Announcements / Notifications / Received Leave closed) |
| Gaps kept | Teacher + Coordinator **Biometric** (RFID/eSSL) |

## Local stack (this Mac)

| Item | Value |
|---|---|
| Postgres | **18.6** EnterpriseDB on **5433** (`qmis_erp`, user `postgres`) |
| API | `./run-local.sh` → http://127.0.0.1:8000 |
| Frontend | `npm run dev` → http://localhost:5173 |
