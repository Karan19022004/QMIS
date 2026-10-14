# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (role-module audit and the Student Database fix, on top of Admin Attendance)  
Result: **264 passed**, 0 failed, 0 skipped (full suite, `python -m pytest tests/ -q` from `backend`, 3 min 20 s, on the working tree of branch `fix/student-database-admissions-lookup`). The 260 on committed code plus 4 new static checks that are **uncommitted**. History of this day: 218 after migration `0002`; 231 after `0003`; 246 after Class Details; 260 after Attendance; 264 after the Student Database fix. The audit itself added no tests.  
Frontend: production build passes (exit 0). ESLint on the changed files (`StudentsList.jsx`, `EmployeesList.jsx`, `useAttendanceQuery.js`, `adminAttendanceApi.js`, `apiClient.js`, and the two attendance data files): no findings. Running ESLint over the whole `Pages/Admin/Attendance` folder also reports three **old** errors (unused `useState` in the three `ExportModal.jsx` files under `Employees/Components`, `LeaveRequest/Components` and `Students/Compnents`); those files were not changed. A whole-project lint count was not run.

Evidence is kept apart. **Automated** = pytest. **Browser** = I drove the real screen against the running backend and the real development database. Anything not run is marked NOT RUN.

## Automated (pytest)

| Area | Tests | What they prove | Result |
|---|---|---|---|
| Admin Attendance API contract (new) | 5 | An Administrator lists every mark for a date across classes and narrows by class and by section; the roster option adds students nobody has marked (status empty, no id) and needs a class (400 otherwise); reads need a login (401), a teacher can read (200) and the date is required (422); an invalid status is refused (400) and all four valid statuses (Present, Absent, Late, Holiday) are accepted; `GET /hr/attendance` is readable by the Administrator, 401 without a token, and keeps stored dates exactly as written (`dd-mm-yyyy` and ISO) | PASS |
| Admin Attendance frontend, static (new) | 9 | The service only reads (no POST, PUT, DELETE, no `upsertAttendanceApi`) and never touches browser storage; the roster is requested only for a class with no section; dates use the local calendar day, not UTC; the flag defaults to the auth flag; the hook derives loading from the request key (no state set before `.then` in the effect) and keeps the last good filter options; both pages keep their local branch and show loading, error with Retry and empty states; the demo data modules stay intact for the other roles; the Super Admin attendance pages do not use the new service | PASS |
| Student Database frontend, static (new, uncommitted) | 4 | The admissions lookup sits behind the students-API flag and the server snapshot is the API-mode source; a Promise is never used as an admission record; API mode never writes the snapshot back; the mapper has no direct network call | PASS |
| Earlier suites | 246 | Migrations `0002` and `0003` on PostgreSQL (26), Class Details API (7) and static (8), HR / login sync, admin users, P0 security, escalations and tasks, admissions, approvals, attendance, exams, finance, HR, leave, lesson plans, Phase 0, students, and the rest | PASS |

The migration tests need a PostgreSQL server; they are reported as skipped, not passed, if none is reachable. This run: none skipped. There is no JavaScript test runner, so frontend behaviour is covered by the static checks above and the browser checks below.

## Role-module audit (13 Oct 2026, evening): browser evidence, reads only

Method: each seeded login was signed in on its own tab; each sidebar route was opened in a hidden frame with `fetch` instrumented, every non-GET `/api/v1` call blocked, and the GET calls and status codes recorded. A page loading was not counted as complete. Writes were not exercised, so every write workflow below is NOT RUN unless marked as driven in an earlier session.

| # | Check | Result |
|---|---|---|
| A1 | Teacher: 30 routes load; own API calls on 5 (Class Attendance, My Tasks, Leave x2, Escalation); 25 modules make none | PASS (loads); 25 modules are browser-only data |
| A2 | Coordinator: 30 routes load; own API calls on 3 (My Tasks, My Leave Requests, Escalation); 27 make none | PASS (loads); 27 modules are browser-only data |
| A3 | Director: 24 routes load; own API calls on 6 (Tasks x2, Student Database, Leave x2, Escalation); 18 make none | PASS (loads); 18 modules are browser-only data |
| A4 | HR: 35 routes load; every page returns the same 25 `/hr/*` collections with 200 | PASS |
| A5 | Account Head: 22 routes load; every page returns `GET /finance/state` 200 on a fresh load | PASS |
| A6 | Account Head signed in through the sign-in page: no finance request, banner "Finance API ... load failed" until reload | **FAIL** (defect: the provider pulls once before sign-in) |
| A7 | `GET /finance/state` for non-finance roles | **FAIL** (403 on every fresh load for Teacher, Coordinator, Director, Principal, HR) |
| A8 | Student Database before the fix: Principal and Director `GET /admissions/{id}` 403 per student (9 of 9); Administrator 9 requests; detail page blanks where the API had values | **FAIL** (defect, fixed in A9) |
| A9 | Student Database after the fix, Principal and Administrator: 0 admissions requests; list 10 rows; detail shows the API values | PASS |
| A10 | Teacher attendance can be marked from the screen | **FAIL** (`upsertAttendanceApi` has no caller in the frontend; read-only) |
| A11 | Runtime errors, 5xx or network failures on any of the 141 routes | PASS (none seen); one blocked-write check is inconclusive for HR batch 1 because the log kept only 10 calls per page |

Not run: any create, edit or approve workflow in this audit, API-outage behaviour (HR is fail-closed in code, not tested), panels with no seeded login, opening the review `.docx` in Word or LibreOffice (neither installed), and local (browser-only) mode after the Student Database fix. Earlier sessions drove tasks (Principal, Teacher, Director, Admin), the Teacher to Principal to HR leave chain, escalations, user creation, the employee directory, class details and admin attendance in a browser.

Review copy of the status sheet (`QMIS-ERP-Role-Module-Status.review.docx`): 25 structural checks, all PASS. They cover the original being byte-identical to its backup, the file being well formed, summary and TOTAL matching the module rows (480 / 122 / 51 / 305 / 2), Administrator at 10 / 4 / 12, status colours matching status text, no remaining Ops reference, the 18 un-re-checked panels keeping their original statuses, an evidence label on every re-checked note, and no password in the text.

## Browser: Admin Attendance (Administrator, live backend, real database)

Before the check, the dev database had **no** student attendance rows. Three real marks for 13 Oct 2026 were saved through the teacher login (Grade 1, section A: Aarav Present with "On Time", one Absent, one Late); the other four Grade 1 students were left unmarked on purpose. This needed an approval because it writes to the dev database.

| # | Scenario | Result |
|---|---|---|
| 1 | Students page loads the day's marks from the server: ADM-0001 Present, ADM-0006 Absent, ADM-0009 Late; columns "Marked At" and "In / Out" with the explanatory note; counts line "Present: 1 · Absent: 1 · Late: 1"; class and section dropdowns filled from the server (Grade 1, Grade 2, V, VIII; A, B, C) | PASS |
| 2 | Class filter Grade 1 with no section: 7 rows, 3 marked and 4 "Not marked" (section shown as "—"); counts "Present 1 · Late 1 · Not marked 4 · Absent 1" | PASS |
| 3 | Section filter A: only the 3 marked students; the note changes to "Choose a class without a section to also see students who are not marked yet" | PASS |
| 4 | Date changed to 12/10/2026: counts "No students listed" and the message "No attendance marked for this date… Nothing has been marked for 2026-10-12 in Grade 1" | PASS |
| 5 | Error state: browser switched offline, section changed: "Could not load attendance / Could not reach the server. Check your connection and try again." with Retry; the class and section dropdowns kept their options | PASS |
| 6 | Network restored, Retry pressed: the page recovered and showed the empty-date message again | PASS |
| 7 | Employees page, today's date: "No attendance records found. Nothing recorded for 2026-10-13. The server holds 5 records on other dates; clear the date to see them." with "Show all dates"; Role options Driver, Security, Supervisor, Teacher and Status options Absent, Late, Leave, Present built from the data | PASS |
| 8 | "Show all dates": 5 rows with names and roles joined from the employee list (Priya Sharma, Vikram Singh, Ramesh Yadav, Farah Qureshi, Imran Khan), punch times, statuses Present / Leave / Present / Late / Absent | PASS |
| 9 | Date typed as 22/09/2026: the 5 records stored as `dd-mm-yyyy` are matched (5 rows) | PASS |
| 10 | Local mode (a second Vite server on port 5180 with API sign-in off and a throwaway demo password): students page keeps the original class list (6th to 12th), sections A to D, columns "On Time / Out Time", 10 demo rows and no explanatory note; employees page keeps the original role list and the Present / Absent statuses and 10 demo rows | PASS (the page load and filters' options only; local filtering and Export were not exercised, their code is unchanged) |

## Not run

| # | Scenario | Result |
|---|---|---|
| 11 | A Teacher or other non-admin role on these pages (the API access rule is proven by pytest; the Administrator pages are not offered to a Teacher) | NOT RUN |
| 12 | A real 403 from the server shown on these pages (the message path exists; no Administrator without the permission exists) | NOT RUN |
| 13 | The partial-failure warning (masters or employee list failing alone) on screen | NOT RUN |
| 14 | The footer text fix ("Showing 1 to 0 of 0 entries" hidden while loading or in error) after it was made; it was seen in the earlier run, the change was only covered by the build, lint and the test suite | NOT RUN |
| 15 | Export from these pages (unchanged, still the old modal), mobile layout, a real server outage, more than a handful of records | NOT RUN |
| 16 | Administrator marking or correcting attendance (not built; read-only by design) | NOT RUN |
| 17 | Whole-project lint | NOT RUN |

## Defects found

- **Found while building and fixed:** a React hooks lint warning on the students page (the records were chosen outside the memo); the footer showed "Showing 1 to 0 of 0 entries" while loading or in error, and now stays blank in those states.
- **Not fixed (design):** the server has no punch-in / punch-out for students, no date filter for HR attendance, and no way to tell a bad HR date format apart (an unrecognised date is not matched by the date filter, but shows under "Show all dates"). Employee attendance has no dedicated endpoint, only the generic HR collection. The pages are read-only; marking stays with teachers.
- **Old, untouched:** three unused-import lint errors in the `ExportModal.jsx` files under `Pages/Admin/Attendance`.

## Side effects on this machine

- Dev database: **new dev data:** three Grade 1 student attendance marks for 13 Oct 2026 (Present, Absent, Late), made through the teacher login. No schema change; still at `0003_class_year_uuid`.
- The temporary Vite server on port 5180 was stopped; the main servers (backend 8000, frontend 5173) are still running. The throwaway local-mode demo password was only set for that one process and is not stored anywhere.
- Backups from the earlier migrations are in `%USERPROFILE%\qmis-db-backups\` (outside the repository, not committed; they contain password hashes, so treat them as sensitive).

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
