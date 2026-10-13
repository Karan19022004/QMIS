# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (Administrator modules, step 1: RBAC User Creation and Roles)  
Result: **189 passed**, 0 failed (full suite, `python -m pytest tests/ -q` from `backend`; 152 before this work, plus 37 new: 32 in `test_admin_users.py`, 5 in `test_frontend_admin_users_static.py`)  
Frontend: production build passes (exit 0). The files changed in this step lint clean (checked with ESLint on exactly those files). A whole-project lint count was not run this time.

Evidence is kept apart. **Automated** = pytest. **Browser** = I drove the real screens against the live backend. Anything not run is marked NOT RUN. A static source check is not a browser check.

## Automated (pytest)

| Area | Tests | What they prove | Result |
|---|---|---|---|
| Create user | 10 | Teacher created with a generated temporary password (returned once, `Cache-Control: no-store`), staff code `TEA-xxxx`, must change password at first login, details saved; an admin-chosen password that meets the policy works and is not echoed; a weak chosen password is refused (400) and nothing is created; staff codes count up per role; duplicate email is 409 in any letter case (also for a seeded login); first name, last name and gender are required; an invalid email is 422; unknown or password-like fields never reach the profile | PASS |
| Privilege rules | 13 | Administrator cannot create admin, superadmin, hr, accounthead, student, parent, director or an unknown role (403, nothing created); a Super Admin can create an Administrator but not a Super Admin; Teacher and HR get 403 on every admin endpoint; no token is 401; an Administrator cannot read, change, deactivate or reset an HR account; a malformed or unknown user id is 404; role and email cannot be changed by an update | PASS |
| List / update / reset | 6 | List filters by role, status and search, limit validated, no temporary password or hash in list rows; deactivating blocks the user's next login and their already-issued token (401), activating restores it; blank detail clears it and the others stay; null on required fields means no change; empty first name refused; reset replaces the old password, forces a change and is `no-store` | PASS |
| Audit | 1 | Create, deactivate and reset are audited with the acting user; neither the chosen password nor any temporary password appears in the audit text | PASS |
| Roles (read-only) | 2 | Roles list with user counts, permission counts and the creatable flag; a role's permissions list (Teacher holds `lessonplans.write`, not `users.write`); unknown role 404; there is no write verb for role permissions (405); the creatable roles for an Administrator are exactly the seven staff roles | PASS |
| Frontend sources (static) | 5 | The admin API service never touches browser storage; the browser copy of API users has `password: ''` and never stores the temporary password; the temporary password only travels in router state and the history entry is wiped; the Roles page is read-only; the password field uses `autoComplete='new-password'` | PASS |
| Existing suites | 152 | P0 security (52), frontend auth static (10), escalations and tasks (19), admissions, approvals, attendance, e2e campus flow, exams, finance, HR, leave, lesson plans, Phase 0, students | PASS |

Static checks read the React sources only; there is no JS test runner in the project.

## Browser (live backend restarted on the new code, frontend dev server)

| # | Scenario | Result |
|---|---|---|
| 1 | Administrator signs in; User Creation page loads from the server | PASS |
| 2 | Submit an empty Create User form: "First name is required." and the button returns to "Create User" (no request sent) | PASS |
| 3 | Fill a Teacher with a 6-character password: the server message "Password must be at least 10 characters long." is shown and the user stays on the form | PASS |
| 4 | Clear the password and save: "User created successfully.", the list shows TEA-0001 Browser Teacher (Teacher, Active), and a notice shows the temporary password once with a Copy button | PASS |
| 5 | Browser copy of users after creation: one record, no password value; the history entry holds no temporary password | PASS |
| 6 | Reload the list: the user is still shown (from the server) and the password notice is gone | PASS |
| 7 | Deactivate, then Activate, then Reset password from the list: row changes to Inactive then Active; reset shows a new one-time password | PASS |
| 8 | Roles page: 27 roles with user count, permission count and "Created here"; Teacher 3 users, 23 permissions, creatable; Administrator 1 user, 42 permissions, not creatable; "View permissions" for Teacher lists its permissions and does not include `users.write` | PASS |
| 9 | The new Teacher signs in with the temporary password: the "Change temporary password" screen appears; a new strong password is saved and the Teacher dashboard opens | PASS (this also runs the must-change change-password flow that was NOT RUN in the P0 round) |
| 10 | The same Teacher calls the admin endpoints with their own token: users 403, roles 403, create-Administrator 403 | PASS |
| 11 | With the browser copy of users emptied, the Administrator opens Add Class Details: the Class Teacher dropdown lists "Browser Teacher" (loaded from the server) | PASS |
| 12 | Duplicate email through the screen (an email that already exists) | NOT RUN (covered by pytest) |
| 13 | Flag-off (browser-only) mode, `VITE_USE_API_ADMIN_USERS=false` | NOT RUN |
| 14 | Admission Enquiry PRM assignee dropdown and Employee Database screen with an API user | NOT RUN (the PRM dropdown uses the same refresh as the class teacher dropdown; Employee Database still reads the browser copy) |
| 15 | Super Admin's own Admin-user screen | NOT RUN (unchanged, still browser-only) |
| 16 | Principal, PRM, Coordinator, Librarian, Gate Keeper Manager and Gate Keeper creation through the screen | NOT RUN (only Teacher was driven; the other roles are covered by pytest for the server rules) |
| 17 | Mobile layout, profile photo and document upload on the form | NOT RUN (upload fields are not sent to the server) |

## Defects found

- **Fixed during this step:** the lint rule against setting state inside an effect flagged the first version of the user list's loader; it now loads through a keyed effect and a Retry button.
- **Found, not fixed:** the shared Create User form keeps the previous error text until the next save (old behaviour); the Employee Database screen reads the browser copy, so an API-created user appears there only after the list or a picker has loaded; the form's upload fields (profile image, ID proof, certificates) are not sent to the server.
- **Carried over from P0, still open:** the local database's `hr_employees.user_id` column is `VARCHAR(36)` but the model expects a UUID, so a non-HR user opening the HR "own record" page gets a 500; the Finance screen keeps a previous user's error after switching users in one tab.

## Side effects on this machine

- The backend on port 8000 was restarted on the new code; on start it created the `user_profiles` table and the three new permissions in the local dev database.
- A dev user `browser.teacher@qmis.edu` (TEA-0001) was created and then deactivated; it still exists (accounts are never deleted). Its password was changed during the check.
- The browser tab used for testing is signed in as the Administrator.

## Commands

```
cd backend
python -m pytest tests/ -q
```

## Coverage notes

- `tests/test_admin_users.py` (32) — admin user creation, privilege rules, lifecycle, audit, roles
- `tests/test_frontend_admin_users_static.py` (5) — frontend source checks for the admin screens
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
