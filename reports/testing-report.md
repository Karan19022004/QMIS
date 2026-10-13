# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (fix for the `hr_employees.user_id` schema mismatch, before Class Details)  
Result: **218 passed**, 0 failed, 0 skipped (full suite, `python -m pytest tests/ -q` from `backend`; 205 before this step, plus 13 new in `test_migration_hr_user_id.py`)  
Frontend: production build passes (exit 0). ESLint on `src/services`, the Employee Database screens and the shared mappers: exit 0, no findings. No frontend source changed in this step; the build and lint were re-run as asked. A whole-project lint count was not run.

Evidence is kept apart. **Automated** = pytest. **Rehearsal** = a script that restored the backup into a scratch database and ran the real migration. **Live** = the running backend and the real development database. **Browser** = I drove the real screen. Anything not run is marked NOT RUN.

## Automated (pytest)

| Area | Tests | What they prove | Result |
|---|---|---|---|
| Migration `0002` on PostgreSQL (throwaway database, dropped afterwards) | 8 | Converts VARCHAR(36) to UUID keeping every row and every link, and adds the foreign key; blank becomes NULL and upper-case is the same UUID; a value that is not a UUID **aborts** and nothing changes (the bad value is kept); a link to a login that does not exist **aborts** and nothing changes; a second run changes nothing; a UUID column without the foreign key gets it; downgrade restores VARCHAR(36), drops the foreign key and keeps the links; **negative control:** the original failing query (`user_id == <uuid>`) raises `character varying = uuid` on the old shape and works after the migration | PASS |
| Startup helper and check | 2 | `ensure_hr_employee_columns` now adds `user_id` as UUID on PostgreSQL; the startup schema check reports the old shape (and names `alembic upgrade head`) and is quiet once migrated | PASS |
| Alembic wiring (no database needed) | 3 | One revision chain ending at `0002_hr_user_id_uuid`; `alembic.ini` and `env.py` store no credentials; the migration is a no-op on non-PostgreSQL databases | PASS |
| HR / login activation sync | 12 (existing) | Deactivate/activate keeps the linked HR record in step; an HR bulk save cannot reactivate a login an admin turned off (with a negative control); Relieved is never overwritten; no credentials in any payload; teacher sees only their own record | PASS (re-run, unchanged) |
| Earlier suites | 193 | Admin users (32), static frontend checks (9), P0 security (52), escalations and tasks, admissions, approvals, attendance, exams, finance, HR, leave, lesson plans, Phase 0, students, and the rest | PASS |

The migration tests need a PostgreSQL server; they are reported as skipped, not passed, if none is reachable. This run: none skipped.

## Rehearsal on a restored copy of the development database (script, not pytest)

The backup was restored into a scratch database (`pg_restore`), then:

| # | Check | Result |
|---|---|---|
| 1 | Backup restores; the copy matches the dev snapshot (17 employees, 2 links) and has no `alembic_version` table | PASS |
| 2 | `alembic upgrade head`: column is `uuid`, foreign key to `users(id)` exists, 17 rows and both links unchanged, `users` and `audit_logs` row counts unchanged, `alembic_version` = `0002_hr_user_id_uuid` | PASS |
| 3 | Second `upgrade head` is a no-op | PASS |
| 4 | `alembic downgrade -1`: back to VARCHAR, no foreign key, rows and links unchanged | PASS |
| 5 | A non-UUID value aborts with the employee code named; after the abort the column is still VARCHAR and the value is intact | PASS |
| 6 | A link to a non-existent login aborts; still VARCHAR, no foreign key, value intact | PASS |
| 7 | A blank value and an upper-case UUID convert; the upper-case link is kept as the same UUID and the blank becomes NULL | PASS |

The scratch database was dropped afterwards (only `postgres` and `qmis_erp` remain).

## Live: the real development database

| # | Check | Result |
|---|---|---|
| 8 | Backup taken before any change: `pg_dump -Fc` (about 146 KB, outside the repository; `pg_restore --list` reads it, 203 entries, `hr_employees` data included) | PASS |
| 9 | Before: 17 employees, 15 with no `user_id`, 2 linked (EMP-0016, EMP-0017) to valid existing logins with matching emails; no blank, malformed, orphan or duplicate values; no foreign keys pointing at `hr_employees`, no views or triggers on it; 10 audit rows refer to HR employees by id | PASS (inspection) |
| 10 | `alembic upgrade head` on the dev database: exit 0, now at `0002_hr_user_id_uuid` (head); `user_id` is `uuid`; foreign key `hr_employees_user_id_fkey` exists | PASS |
| 11 | After: employee rows identical (id, code, email, status, created_at), both links identical, 10 audit rows still refer to HR employees, 443 audit rows total, no row-count change in any table except the new `alembic_version` | PASS |
| 12 | `GET /hr/portal/employees` (and `/hr/employees`) after restarting the backend on the new code: **Teacher 200, Coordinator 200, Principal 200, Director 200, Admin 200 (17 rows), HR 200 (17 rows)**; Account Head and Finance Assistant 403; no token 401. (Before: Teacher, Coordinator, Principal and Director returned **500**.) The four scoped roles get an empty list because their seeded logins have no HR record, so nothing is leaked | PASS (the earlier 500s are fixed) |
| 13 | A user whose HR record is linked by `user_id` (`live.link@qmis.edu`): after reactivation, reset and a password change, the portal and the typed list return only their own record (EMP-0017); another employee's record is 404; their own is 200; `admin/users` is 403 | PASS |
| 14 | HR / login activation sync on the migrated database: activating the login set the HR record to Active; deactivating set it to Inactive; the deactivated user's token and login both returned 401 | PASS |
| 15 | Browser: the Administrator's Employee Database reloaded against the migrated database shows "Showing 18 of 18 entries" (17 HR employees + 1 User Creation login) | PASS |

## Not run

| # | Scenario | Result |
|---|---|---|
| 16 | The HR "own record" page and the Employee Database screen in a browser signed in as Teacher, Coordinator, Principal and Director (checked through the API only, #12 and #13) | NOT RUN |
| 17 | `alembic downgrade` on the development database itself (rehearsed on the copy only; the dev database was deliberately not downgraded) | NOT RUN |
| 18 | A real restore of the backup over the development database (restore was proven on the scratch copy only) | NOT RUN |
| 19 | A live HR bulk save from the HR screen (covered by pytest; it rewrites every HR row) | NOT RUN |
| 20 | The migration against a database with bad data in it other than on the scratch copy (aborts proven by pytest and by the rehearsal) | NOT RUN |
| 21 | Whole-project lint; mobile layout; the earlier User Creation items still listed as NOT RUN in the previous round | NOT RUN |

## Carried over from the previous step (not re-run, except #15 above)

Employee Database in the browser as Administrator: list, search, department filter, HR and login detail pages, one-row merge by email, reload persistence, local mode (no API calls) — PASS. Error, empty, 403 and partial-failure states were checked by overriding `fetch` (simulated, not a real outage) — PASS. Deactivating from the User Creation screen and watching the HR status on screen, a real outage, and the Principal/Director/Super Admin screens — NOT RUN.

## Defects found

- **Fixed in this step:** `hr_employees.user_id` is now a UUID column with the foreign key the model declares, on the development database (via Alembic) and for databases that get the column from the startup helper (the helper no longer creates it as VARCHAR). The 500 for Teacher, Coordinator, Principal and Director on `GET /hr/portal/employees` is gone.
- **Found, not fixed (other features, each needs its own reviewed revision):** the same VARCHAR(36)-vs-UUID drift on `school_classes.academic_year_id`, `admission_enquiries.profile_image_file_id` and `admission_enquiries.converted_admission_id`; `hr_employees.employee_code` is 32 characters live against 40 in the model.
- **Open (design):** Alembic is applied by hand (`alembic upgrade head`); startup only warns. Other databases (a teammate's copy, production) are not migrated until someone runs it. The other `ensure_*` startup helpers are unchanged.

## Side effects on this machine

- Python package `alembic` 1.20.0 was installed (also added to `backend/requirements.txt`). The dev database now has an `alembic_version` table (one row).
- The backend on port 8000 was restarted on the new code. The backup file is at `%USERPROFILE%\qmis-db-backups\` (outside the repository, not committed; it contains password hashes, so treat it as sensitive).
- Dev data: `live.link@qmis.edu` (TEA-0002) was reactivated, given a new password (not recorded) and deactivated again; it and its HR record EMP-0017 are Inactive. No employee records were created or deleted.

## Commands

```
cd backend
python -m pytest tests/ -q
alembic current
alembic upgrade head      # after a backup
```

## Seeded API logins (development only)

| Role | Email |
|---|---|
| Admin | admin@qmis.edu |
| Teacher | teacher@qmis.edu |
| Coordinator | coordinator@qmis.edu |
| Principal | principal@qmis.edu |
| Director | director@qmis.edu |
| HR | hr@qmis.edu |
| Account Head | accounthead@qmis.edu |

These exist only when `ENVIRONMENT=development`. Passwords are not recorded in this report; they come from the seed settings in `backend/.env`.
