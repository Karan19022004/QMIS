# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (Administrator modules, step 2: Employee Database connected to the HR employee API)  
Result: **205 passed**, 0 failed (full suite, `python -m pytest tests/ -q` from `backend`; 189 before this step, plus 16 new: 12 in `test_admin_employee_directory.py`, 4 in `test_frontend_admin_users_static.py`)  
Frontend: production build passes (exit 0). The files changed in this step lint clean (ESLint on exactly those files, exit 0). A whole-project lint count was not run.

Evidence is kept apart. **Automated** = pytest. **Browser** = I drove the real screens against the live backend. Anything not run is marked NOT RUN. A static source check is not a browser check.

## Automated (pytest)

| Area | Tests | What they prove | Result |
|---|---|---|---|
| Directory read | 4 | The Administrator sees every HR employee, including one HR created a moment ago, and the same set HR sees; portal rows carry the fields the screen maps; no credential-like key (`password`, `hash`, `secret`, `token`) in the portal, typed or admin-users payloads (only `mustChangePassword`), and none of the temporary passwords issued in the test appear in any of them | PASS |
| Permissions | 3 | A teacher sees only their own record and gets 403 on admin users; no token gets 401; there is no single-record PATCH or DELETE route on employees | PASS |
| HR / login consistency | 5 | Deactivating a login marks the linked HR record Inactive and activating restores it, with an `HR_EMPLOYEE_STATUS_SYNCED` audit row; an HR bulk save cannot reactivate a login an admin turned off; **negative control:** with the sync disabled, the same bulk save does reactivate the login (so the test can fail); Relieved is never overwritten; a login with no HR record is unaffected; a user created through User Creation gets no HR record | PASS |
| Frontend sources (static) | 4 new (9 in file) | The directory service never touches browser storage and never copies salary, password or `extra`; it uses only the existing endpoints and is read-only; the detail page shows no password in API mode and still shows it in local mode; the flag exists, the hook is skipped in local mode, and the shared Principal / Director / Super Admin screens do not use the API hook | PASS |
| Earlier suites | 189 | Admin users (32), P0 security (52), frontend auth static (10), escalations and tasks (19), admissions, approvals, attendance, e2e campus flow, exams, finance, HR, leave, lesson plans, Phase 0, students | PASS |

Static checks read the React sources only; there is no JS test runner in the project.

## Browser (live backend restarted on the new code; Administrator; frontend dev server)

**PASS** (driven and observed)

| # | Scenario | Result |
|---|---|---|
| 1 | Employee Database loads from the server: 17 rows (16 HR employees + 1 User Creation login), each labelled with its source | PASS |
| 2 | Search "priya" shows 1 row; a name that does not exist shows 0 rows; clearing restores all 17 | PASS |
| 3 | Department filter "Transport" shows 3 rows (Vikram, Ramesh, Lakshmi); the department list is built from the data | PASS |
| 4 | Detail of an HR employee (EMP-2026-001), opened by direct URL: HR fields, designation, category, reporting manager and status shown; salary reads "Restricted (HR)"; no password row; status matches what the API returns | PASS |
| 5 | Detail of a User Creation login (TEA-0001): employee type "—", status and login note shown, username is the login email, no password | PASS |
| 6 | Unknown id shows "Employee not found." | PASS |
| 7 | One person, one row: a login and an HR record with the same email (EMP-0017) appear once, as the HR record, with "Login created through User Creation (TEA-0002, Inactive)" | PASS |
| 8 | Persistence: after full reloads the same data comes back from the server; the browser copy of users holds no record of the HR-linked person (nothing is stored for the directory) | PASS |
| 9 | Loading text, error with Retry, empty ("No employees have been added yet."), 403 message, and partial failure (HR rows shown with a warning naming the failed source; Retry recovers all 17) | PASS, but see the note: these failures were **simulated** by overriding `fetch` in the page, not by stopping the server |
| 10 | Local mode (a second dev server with the API flags off, demo session): original department list, original subtitle, "No employees found.", and **no** API request made | PASS |

**Live API checks** (a script against the running backend, not a browser)

| # | Scenario | Result |
|---|---|---|
| 11 | Anonymous: HR portal 401, admin users 401. Teacher, Coordinator, Principal, Director, Account Head, HR: admin users 403. Admin and HR: HR portal 200 with 16 rows. Account Head and Finance Assistant: HR portal 403 | PASS |
| 12 | Deactivating a linked login set the HR record to Inactive; activating set it back to Active; deactivating again left it Inactive (login created, HR record added with the same email, then status changed three times) | PASS |

**FAIL** (found; pre-existing, not caused by this step, not fixed)

| # | Scenario | Result |
|---|---|---|
| 13 | `GET /hr/portal/employees` as Teacher, Coordinator, Principal and Director returns **500** (`character varying = uuid`: the dev database column `hr_employees.user_id` is `VARCHAR(36)` while the model expects a UUID). The Administrator and HR are not affected. This is the same defect recorded in the P0 round and needs a column migration | FAIL (pre-existing) |

**NOT RUN**

| # | Scenario | Result |
|---|---|---|
| 14 | Deactivating the login **through the User Creation screen** and then watching the HR status change on the Employee Database screen (the same endpoint was checked by script, #12, and in pytest) | NOT RUN |
| 15 | A real outage (stopping the backend) to see the error state; the states in #9 were simulated | NOT RUN |
| 16 | Local-mode detail page with a created employee, and local-mode Export | NOT RUN |
| 17 | Principal, Director and Super Admin Employee Database screens (not changed, still local-mode; the static test confirms they do not use the API hook) | NOT RUN |
| 18 | Mobile layout; sorting; the Export button (unchanged and not exercised) | NOT RUN |
| 19 | An HR bulk save from the HR screen against the dev database (covered by pytest; not run live, because it rewrites all HR rows) | NOT RUN |
| 20 | Whole-project lint; the earlier User Creation items 12–17 (duplicate email on screen, flag-off User Creation, other roles) | NOT RUN |

## Defects found

- **Fixed in this step (server):** HR's bulk save could switch a login back on after an Administrator had deactivated it. `PATCH /admin/users/{id}` now keeps the linked HR record in step (matched by email) and writes an audit row; proven by a test that fails when the fix is removed.
- **Fixed in this step (screen):** the list reloaded its local copy through an effect that set state (a lint error that was already there); it now derives the list instead. The shared builder showed the account status in the "Employee type" field; the API rows now show "—".
- **Found, not fixed:** the `hr_employees.user_id` column mismatch above (#13); HR statuses On Leave and Probation are shown as they are and do not change the login; the list's "From / To" date controls do nothing (as before); the old User Creation notes from the previous round (upload fields are not sent to the server, the form keeps a previous error text until the next save) still apply.

## Side effects on this machine

- The backend on port 8000 was restarted on the new code (no schema change in this step).
- Dev data added: a login `live.link@qmis.edu` (TEA-0002) and an HR employee EMP-0017 for it; both are now Inactive (accounts and HR records are not deleted). The earlier `browser.teacher@qmis.edu` (TEA-0001) is still Inactive.
- A temporary second dev server on port 5180 was used for the local-mode check and has been stopped. The Administrator tab on port 5173 stays signed in.

## Commands

```
cd backend
python -m pytest tests/ -q
```

## Coverage notes

- `tests/test_admin_employee_directory.py` (12) — directory read, permissions, HR / login consistency (with a negative control)
- `tests/test_frontend_admin_users_static.py` (9) — frontend source checks for the admin screens (5 User Creation, 4 Employee Database)
- `tests/test_admin_users.py` (32) — admin user creation, privilege rules, lifecycle, audit, roles
- `tests/test_security_p0.py` (52), `tests/test_frontend_auth_static.py` (10) — P0 hardening
- `tests/test_escalations_tasks.py` (19), `test_leave.py`, `test_exams.py`, `test_lesson_plans.py`, `test_approvals.py`, `test_students.py`, `test_attendance.py`, admissions, parents/children, finance, HR, Phase 0
- Pytest is not a browser pass for any screen

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
