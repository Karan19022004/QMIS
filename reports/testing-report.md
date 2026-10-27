# Testing report

**Date:** 27 October 2026  
**Branch:** `main` (QMIS repo)  
**Context:** Academic privacy, approval routing, substitute duty, attendance change audit

## Backend (full suite)

| Metric | Count |
|---|---|
| Passed | **520** |
| Failed | **0** |
| Skipped | **35** (PostgreSQL-only migration tests: no database-creation rights / no `TEST_PG_URL`) |
| Duration | ~3 minutes 51 seconds |

Command: `python -m pytest tests -q` from `backend/` (isolated in-memory SQLite).

New test files this day:
- `test_academic_privacy.py` (26)
- `test_academic_access_phase2.py` (21)
- `test_academic_access_phase3a.py` (19)
- `test_academic_phase4.py` (14)
- `test_attendance_audit.py` (8)
- `test_migration_substitute_duties.py` (opt-in, skipped without `TEST_PG_URL`)

## Frontend

`npm run build` passed (~1 minute 22 seconds).

## Live database

- Backup `qmis_erp_before_0020_20261027_185916.dump` verified with `pg_restore --list`.
- Migration 0020 applied (0019 → 0020); row counts unchanged.
- Backend health check, demo logins (admin, principal, teacher) and CORS from the frontend verified.

## Browser

Not tested for the new screens (Substitute Duty, Class Attendance options).
