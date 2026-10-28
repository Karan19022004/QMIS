# Testing report

**Date:** 28 October 2026  
**Branch:** local uncommitted work (not pushed)  
**Context:** Prioritized stabilization — auth NullPool verify, ProTrack fallback guard, canteen persist hardening. **No live campus DB writes.**

## Latest pytest

| Suite | Result |
|---|---|
| Focused stabilization batch (auth stability + production-readiness static + canteen persist + finance assistant perms + admissions + principal/coordinator/teacher/parent/student portal APIs) | **32 passed** |
| `test_sqlite_file_auth_stability` alone | **3 passed** |
| ProTrack static + `test_protrack_proxy` + canteen persist (earlier same pass) | **6 passed** |

## Isolated API (`:8001` file SQLite, NullPool)

| Check | Result |
|---|---|
| Concurrent `GET /auth/me` ×16 | **16/16 200** |
| No token / bad password | **401 / 401** |
| Masters years/classes | **200** |
| Principal create admission | **403** (expected) |
| Admin `/auth/me` | **200** |

## Frontend build

| Check | Result |
|---|---|
| `npm run build` | **PASS** (`✓ built`) |

## Browser UAT

| Check | Result |
|---|---|
| Full academic workflow (exam→marks→results→portals) | **NOT RUN** this pass (API/portal suites only) |
| Prior same-day: Super Admin / Finance Assistant shells | **PASS** (see earlier testing-report notes) |

## Notes

- ProTrack `devicesList[0]` fallback is **absent** in current `useProtrackLive.js`; guarded by static tests.
- Canteen `saveOrders` now throws unless `persistCampusJson` reports `success`.
- Auth NullPool fix remains uncommitted; do not treat live Postgres as covered by this SQLite race.
