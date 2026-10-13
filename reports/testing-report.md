# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (migration `0003` for `school_classes.academic_year_id`, then Admin Class Details connected to the masters API)  
Result: **246 passed**, 0 failed, 0 skipped (full suite, `python -m pytest tests/ -q` from `backend`). History of this day: 218 after migration `0002`; 231 after `0003` (+13); 246 after Class Details (+7 API contract, +8 static frontend checks).  
Frontend: production build passes (exit 0). ESLint on the changed files (`src/services`, the Class Details page, add page, hook, two components, `academicsCatalogData.js`): exit 0, no findings. Running ESLint over the whole `Class/ClassDetails` folder also reports one **old** error in `Components/ExportModal.jsx` (unused `useState`); that file was not changed and was left alone. A whole-project lint count was not run.

Evidence is kept apart. **Automated** = pytest. **Rehearsal** = a script that restored the backup into a scratch database and ran the real migration. **Live** = the running backend and the real development database. **Browser** = I drove the real screen. Anything not run is marked NOT RUN.

## Automated (pytest)

| Area | Tests | What they prove | Result |
|---|---|---|---|
| Migration `0003` on PostgreSQL (throwaway database, dropped afterwards) | 13 | Converts VARCHAR(36) to UUID keeping every class, every year link and every section; blank becomes NULL and an upper-case value is the same UUID; a value that is not a UUID **aborts** with nothing changed; a link to an academic year that does not exist **aborts**; a class linked to a year on a **different campus** **aborts**; a second run changes nothing; a UUID column without the foreign key gets it; downgrade restores VARCHAR(36), drops the foreign key and keeps the links; **negative control:** `academic_year_id == <uuid>` raises `character varying = uuid` on the old shape and works after; class → year and section → class relationships and the foreign-key rule hold; the startup helper adds UUID; the startup check reports the old shape and is quiet once migrated | PASS |
| Migration `0002` on PostgreSQL (earlier step, re-run) | 13 | `hr_employees.user_id` conversion, abort rules, idempotence, downgrade, negative control, startup helper, wiring (now one chain `0003 → 0002 → 0001`) | PASS |
| Class Details API contract (new) | 7 | A new class defaults to the current year and gets its first section (letter upper-cased); the year filter returns only that year's classes and the unfiltered list returns all; an unknown year is `404 academic_year_not_found` and creates nothing; a duplicate class is `409 class_exists` and a duplicate section `409 section_exists` (the codes a retry relies on); a section for an unknown class is 404; Teacher can read classes but gets 403 creating a class or section, and no token is 401; the API has no class update or delete | PASS |
| Class Details frontend, static (new) | 8 | The service only uses the three masters routes, never touches browser storage and never sends DELETE/PATCH/PUT; the year filter goes to the server and only an unfiltered list is mirrored; save looks the class up first and treats 409 as present; the flag defaults to the auth flag; the mirror keeps local-only fields, never removes a class and holds no password; the list and add screens hide capacity / teacher / room and Edit / Delete in API mode and keep the local branch; the hook derives loading from the request key (no state set inside the effect body) | PASS |
| Earlier suites | 205 | HR / login sync (12), admin users (32), earlier static checks (13), P0 security (52), escalations and tasks, admissions, approvals, attendance, exams, finance, HR, leave, lesson plans, Phase 0, students, and the rest | PASS |

The migration tests need a PostgreSQL server; they are reported as skipped, not passed, if none is reachable. This run: none skipped. There is no JavaScript test runner, so frontend behaviour is covered by the browser checks below, not by unit tests.

## Rehearsal of `0003` on a restored copy of the development database (script, not pytest)

The backup was restored into a scratch database (`pg_restore`), then the real migration was run there:

| # | Check | Result |
|---|---|---|
| 1 | Backup restores; the copy matches the dev snapshot | PASS |
| 2 | `alembic upgrade head`: column is `uuid`, foreign key to `academic_years(id)` exists, classes, years and sections unchanged, `alembic_version` = `0003_class_year_uuid` | PASS |
| 3 | A second `upgrade head` is a no-op | PASS |
| 4 | `alembic downgrade -1`: back to VARCHAR, no foreign key, data unchanged | PASS |
| 5 | A non-UUID value aborts; the column is still VARCHAR and the value intact | PASS |
| 6 | A link to a year that does not exist aborts; nothing changed | PASS |
| 7 | A class linked to a year on another campus aborts; nothing changed | PASS |
| 8 | A blank value and an upper-case UUID convert (blank → NULL, upper-case kept as the same UUID) | PASS |
| 9 | A throwaway API server on the migrated copy: filtering by a real year returns 200 (it was 500); a new class defaults to the current year; an unknown year is 404; a section is created with the class; Teacher gets 403 creating a class | PASS |

The scratch database was dropped afterwards.

## Live: the real development database (`0003`)

| # | Check | Result |
|---|---|---|
| 10 | Backup taken before any change: `pg_dump -Fc`, outside the repository, readable with `pg_restore --list` (it holds password hashes, so it is sensitive) | PASS |
| 11 | Before: 1 class (Grade 1) with no academic year, 1 academic year (2026-27). The migration's own checks found no non-UUID, orphan or cross-campus value (it would have aborted). The only table that references `school_classes` is `sections` (`sections_class_id_fkey`), which is untouched | PASS (inspection) |
| 11a | Read-only check after all the browser work: at `0003_class_year_uuid`; `academic_year_id` is `uuid`; classes are Grade 1 (no year, 0 sections) and V (2026-27, 3 sections); foreign keys on `school_classes` are `school_classes_academic_year_id_fkey` → `academic_years` and `school_classes_campus_id_fkey` → `campuses`; `sections_class_id_fkey` → `school_classes` | PASS |
| 12 | `alembic upgrade head` on the dev database: exit 0, now at `0003_class_year_uuid` (head); column is `uuid`; foreign key `school_classes_academic_year_id_fkey` exists | PASS |
| 13 | After: the class, the year and the sections are identical to the snapshot; no table changed except `alembic_version` | PASS |
| 14 | `GET /masters/classes?academic_year_id=<current>` returned 200 (empty list, as Grade 1 has no year); the HR portal still returns 200 for Admin, HR, Teacher and Principal; a rolled-back SQL join worked and the foreign key rejected an unknown year | PASS |

## Browser: Admin Class Details (Administrator, live backend, real database)

Signed in as the seeded Administrator against the running backend; the other flag-on pages were not touched.

| # | Scenario | Result |
|---|---|---|
| 15 | List loads from the server: columns Class / Section / Academic Year, one row (Grade 1, "—", "—"); the Academic Year filter lists "2026-27 (current)" from the server; the note that capacity, teacher and room are not stored is shown; the From / To date pickers are hidden | PASS |
| 16 | Filter by 2026-27 (server-side): Grade 1 (no year) is correctly absent and "No classes match these filters / Clear the filters" is shown | PASS |
| 17 | Add form (API mode): Class, Academic Year and Section inputs only (no teacher, capacity or room), the year dropdown lists the server years | PASS |
| 18 | Create class V with sections a and b: the button shows "Saving…" and is disabled, then redirects to the list with "Class V created; sections added: A, B."; the list shows V · A, B · 2026-27 | PASS |
| 19 | Retry-style save (class V again with A and C): "Class V already existed; sections added: C; already present: A."; the list shows A, B, C; no duplicate class or section | PASS |
| 20 | Year filter after the creates: 2026-27 shows only V (A, B, C) | PASS |
| 21 | Error state: with the network switched off in the browser (Chrome emulation), changing the filter shows "Could not load classes" with Retry and the year list kept; after the network is restored, Retry loads both classes | PASS (the offline message at that moment was the raw "Failed to fetch"; the text was then changed to "Could not reach the server. Check your connection and try again." — that new text was **not** seen on screen) |
| 22 | Mirror: after the list loaded, the browser catalog `schoolerp-academics-catalog` held classes `Grade 1, V` and sections `A, B, C`, so the screens that still read it can offer the same classes | PASS (catalog contents only; the other screens were not opened) |
| 23 | Local mode (a second Vite server on port 5180 with API sign-in off, demo login with a throwaway password): original seven columns, teacher / capacity / room fields and the section capacity input present, no Academic Year filter, class VI saved locally and listed (A=25, capacity 40), **0 requests to the backend** | PASS (save and list only; local Edit / Delete were not exercised, their code is unchanged) |

## Not run

| # | Scenario | Result |
|---|---|---|
| 24 | A non-admin role in a browser (Teacher can read but not create: proven by pytest and not driven in a screen; the admin routes are not offered to Teacher) | NOT RUN |
| 25 | A real 403 from the server shown on the Add screen (the message path exists; no Administrator without `masters.write` exists) | NOT RUN |
| 26 | A partial section failure on the Add screen (the service logic is covered by static checks; a failing section could not be produced against the real server) | NOT RUN |
| 27 | The other screens that read the class catalog (student allocation, assigned classes, activities, lesson plans, documents) opened with an API-mirrored class | NOT RUN |
| 28 | The new friendly "Could not reach the server" text on screen; mobile layout; a second tab open while saving | NOT RUN |
| 29 | `alembic downgrade` on the development database itself, and a real restore of the backup over it (both proven on the scratch copy only) | NOT RUN |
| 30 | `0003` against a database with bad data other than the scratch copy (aborts proven by pytest and by the rehearsal) | NOT RUN |
| 31 | Whole-project lint | NOT RUN |

## Defects found

- **Fixed:** `school_classes.academic_year_id` is now a UUID column with the foreign key the model declares, on the development database (via Alembic) and for databases that get the column from the startup helper. `GET /masters/classes?academic_year_id=<real year>` no longer returns 500.
- **Found while building and fixed:** the offline error text showed the raw browser message; it now says the server could not be reached.
- **Not fixed (design, needs a decision):** the server stores no class capacity, section capacity, class teacher or room number, and has no class update or delete. In API mode those fields and the Edit / Delete actions are hidden and each screen says so; they need a backend change first. The other class-catalog screens only see server classes after the Class Details list or Add screen has run in that browser (no refresh at sign-in).
- **Found, not fixed (other features, each needs its own reviewed revision):** the same VARCHAR(36)-vs-UUID drift on `admission_enquiries.profile_image_file_id` and `admission_enquiries.converted_admission_id`; `hr_employees.employee_code` is 32 characters live against 40 in the model; an old unused `models/masters.py` duplicates the masters models. Old lint error in `Components/ExportModal.jsx`.
- **Open (design):** Alembic is applied by hand (`alembic upgrade head`); startup only warns, so a teammate's copy or production is not migrated until someone runs it and takes a backup first.

## Side effects on this machine

- Dev database: now at `0003_class_year_uuid`. **New dev data:** class `V` with sections A, B, C (2026-27), created through the screen; the API cannot delete or rename a class, so it stays. The earlier HR test records are unchanged.
- Backups are in `%USERPROFILE%\qmis-db-backups\` (outside the repository, not committed; they contain password hashes, so treat them as sensitive): `qmis_erp_before_hr_user_id_uuid_*.dump` and `qmis_erp_before_class_year_uuid_*.dump`.
- The temporary Vite server on port 5180 was stopped; the main servers (backend 8000, frontend 5173) are still running. The throwaway local-mode demo password was only set for that one process and is not stored anywhere.
- Python package `alembic` is installed (and in `backend/requirements.txt`).

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
