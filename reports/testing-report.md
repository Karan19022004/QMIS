# Testing report

**Date:** 28 October 2026  
**Context:** Module 2 Class Timetable fixes (TT-01–TT-07). Isolated SQLite pytest only. **No live DB writes.**

## Suites

| Suite | Result |
|---|---|
| `tests/test_academics_collections.py` | **14 passed** |
| Access phase2+3a `-k timetable` (`--import-mode=importlib`) | **4 passed** |
| `tests/test_frontend_fixes_static.py` timetable-related | **6 passed** |
| Frontend `npm run build` | **PASS** |

## Coverage notes

- TT-01/02: FE await save, hydrate null-on-error, `canSaveClassTimetables` gate (static + UI).
- TT-03/04: API 422 on unknown subject / allocation miss / overlapping class or teacher periods; failed PUT leaves prior rows.
- TT-05: Coordinator PUT with `Approved` forced to `Pending`.
- TT-07: Student FE requires `approvalStatus === 'Approved'`.
- TT-06: UI remains disabled; no new workflow invented.

## Not run

- Principal / Teacher / Student / Parent browser UAT
- Live PostgreSQL
