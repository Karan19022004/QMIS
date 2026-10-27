# Testing report

**Date:** 27 October 2026 (evening, final regression)  
**Branch:** `main` (QMIS repo), uncommitted changes  
**Context:** Frontend fixes, admissions login by grade, leave limit, fees (reminders, confirmation, gateway settlement), lesson plan merge, Star of the Month server storage, per-user notification reads, admission referrals, File Management, Camera register

## Backend (full suite)

| Metric | Count |
|---|---|
| Passed | **580** |
| Failed | **0** |
| Skipped | **35** (PostgreSQL-only migration tests: no `TEST_PG_URL`) |
| Duration | ~4 minutes 6 seconds |

Command: `.venv\Scripts\python.exe -m pytest tests -q` from `backend/` (isolated in-memory SQLite).  
Note: the global `python` has an unrelated `tests` package installed that hides the project's `tests/conftest.py`; use the project virtual environment.

New or extended tests:
- `test_frontend_fixes_static.py` (31): crash pages, student and staff lists, promotion, fee split and concessions (run through Node), timetables, attendance, biometric, bell, restored routes, portal placement status, lesson plan API wiring, Star of the Month server saves, referral form, new pages
- `test_admissions.py`: typed route and bus stop, student login kept on edit, junior classes parent-only, referral recorded, kept, listed and cleared
- `test_leave.py`: 2-day monthly cap for Casual and Personal, month split, denied leave frees days
- `test_finance_actions.py`: gateway payment settles once, already-paid instalment flagged, cheque cleared twice pays once, parent payment notification
- `test_fee_reminders.py` (3): 15-day reminder once, weekly final-month summary, parent-only
- `test_notification_reads.py` (2): a role-wide notice read by one person stays unread for others
- `test_ops_and_audit_collections.py`: Star of the Month saved one class at a time; parents blocked
- `test_file_management_and_cameras.py` (4): upload, list, download, delete rules; camera register rules (no passwords in links)

## Database

- Backup `C:\karan\QMIS_backups\qmis_erp_before_0021_20261027_211215.dump`, checked with `pg_restore --list` (357 entries)
- Migration 0021 applied (0020 → 0021): adds `admission_referrals` and `notification_reads`; Alembic has one head; existing row counts unchanged

## Frontend

- `npm run build` passed (~1 minute 10 seconds)
- ESLint on the 77 changed files: no new errors; 13 files have fewer errors than before

## Browser (read-only; nothing saved)

- Principal: Employee Database (43 staff with data), Teacher Allocation (real HR teachers), Create Class Timetable (teacher list and no-allocation hint), Promote Students (Select all → 1 selected, target Grade 8), Student Database class filter (30 → 14), Class Timetable list filters
- Admin: Admission List (enrolled rows show "Enrolled"), Student Database search, bell "View all" → `/admin/notifications`, File Management (4 files, all in use), Camera Management (empty register)
- PRM: Add Admission shows the Referral section; choosing LKG hides the student login
- Teacher: Students List, Biometric, Class Routine, leave form 2-day hint
- Coordinator: Students List (25), Section Assignment, Promote (own grade band only), Class Timetable list, Lesson Plan tabs, Star of the Month matrix loads from the server
- Account Head: Fee Collection class filter (30 → 14), Unpaid / Paid / All views, no "View all" in the bell, Admission Referrals page
- Student / Parent: placed child now shows timetable and real attendance figures (after the placement status fix)
- Director: Class Timetable approvals with empty date filters and the restored menu entry

Backend log: no server errors and no connection-pool errors since the current backend process started. Earlier pool timeouts occurred only while the dev server was reloading during code edits.
