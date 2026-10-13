# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (P0 security hardening)  
Result: **152 passed**, 0 failed (full suite, `python -m pytest tests/ -q` from `backend`; 90 before this work, plus 62 new: 52 in `test_security_p0.py`, 10 in `test_frontend_auth_static.py`)  
Frontend: production build passes (exit 0). Lint on the touched files shows only problems that were already there (checked against the committed version of `AuthContext.jsx`: the same 3 "fast refresh" errors and 1 missing-dependency warning; `AdminssionList.jsx` line 40 and `ExportModal.jsx` line 1 are old and untouched). A whole-project lint count was not run this time.

Evidence is kept apart. **Automated** = pytest. **Live API** = a direct call to the running backend after a restart on the new code. **Browser** = I drove the real screens. Anything not run is marked NOT RUN. A static source check is not a browser check.

## Automated (pytest)

| Area | Tests | What they prove | Result |
|---|---|---|---|
| Startup with insecure production config | 20 | Default environment is production; default JWT secret, short secret, placeholder secret, `OTP_DEBUG`, `*` CORS, demo integrations and default DB password are each refused with a clear message; staging/prod/blank/test names get no relaxation; a secure production config is accepted; `development`, `dev`, `local` allowed; importing the app in a separate process with an insecure production environment fails ("Refusing to start") and succeeds with a secure one | PASS |
| Demo accounts | 2 | Production mode creates zero users; development creates the demo users | PASS |
| OTP | 5 | Challenge response is identical for a known and an unknown email; no code is created for an unknown email but it is audited; no `debug_code` outside development even with `OTP_DEBUG=true`; `debug_code` only in development with the flag; verify failure is identical for known and unknown | PASS |
| Rate limit and lockout | 10 | Sliding window and "blocked attempts are not recorded"; 5 wrong passwords then 429 with `Retry-After` (also with the correct password); same answer for an unknown email; lockout lifts after the window; success resets the counter; lockout audited; per-IP block across many emails; OTP request limit for known and unknown emails; OTP verify lockout also burns the code; change-password current-password guessing limited | PASS |
| Password validation | 15 | Rejects short, no number, no letter, common, repeated, leading/trailing space, over 72 bytes, email name; accepts strong; HR temporary passwords are random and meet the policy; weak change refused (422) and the old password still works; reuse refused; old weak seeded login still works; a strong change succeeds; parent account creation enforces the policy | PASS |
| Frontend sources (static) | 10 | No seeded passwords or the old shared demo password in `src`; `apiLogin` is only called from the sign-in context with the typed values; HR and Finance clients do not import the login API and rely on the signed-in token; no prefilled credentials on the sign-in page; no local fallback after an API login failure; the fake OTP login is gone; stored role is verified with the server; demo switch is development-only | PASS |
| Existing suites | 90 | Admissions, approvals, attendance, demo integrations, e2e campus flow, escalations and tasks (19), exams, finance, HR, leave, lesson plans, Phase 0, students | PASS |

Test passwords were changed in six existing test files (parent accounts and one change-password test) only because the new rule needs 10 characters; assertions are unchanged.

## Live API (running backend, restarted on the new code)

| Check | Result |
|---|---|
| Login, `/auth/me` returns the signed-in user | PASS |
| Wrong password: 401, generic message | PASS |
| OTP challenge: known and unknown email same status and shape; unknown gets no code | PASS |
| OTP code issued only because this machine is `ENVIRONMENT=development` with `OTP_DEBUG=true`; code works once, second use 401; wrong code identical for known and unknown | PASS |
| Lockout: 5 failures (401) then 429 with `Retry-After: 900` | PASS |
| Logout endpoint 200 | PASS |
| Expired token 401; tampered token 401; no token 401 | PASS |
| HR user reads HR data (200); HR user cannot read finance (403) | PASS |
| Account Head reads finance state (200); cannot read HR data (403) | PASS |
| Without a token: HR data 401, finance state 401 | PASS |
| Principal's existing session still reads tasks, escalations and leave requests (200) | PASS |
| Backend refuses to start with this machine's old `.env` that has no `ENVIRONMENT` (exit 1, message names the three unsafe settings) | PASS |
| Teacher reads HR "own record" (`/hr/portal/employees`) | **FAIL** (500). Not caused by this work: the local database column `hr_employees.user_id` is `VARCHAR(36)` while the model expects a UUID. Not fixed (database migration, outside P0) |

## Browser (live backend and frontend)

| # | Scenario | Result |
|---|---|---|
| 1 | Sign-in page has no demo-account button, no prefilled credentials, no shared demo password | PASS |
| 2 | Wrong password: "Invalid email or password." and stay on the sign-in page | PASS |
| 3 | Six wrong attempts for one email: 6th shows "Too many attempts. Try again in 15 minutes." | PASS |
| 4 | HR signs in through the form: lands on the HR dashboard with real HR data (16 employees); server says the token is `hr@qmis.edu` / role `hr` | PASS |
| 5 | Signed in as HR, opening the Account Head URL: sent back to the HR dashboard; token still HR; finance with that token 403; no silent login as another user | PASS |
| 6 | Sign out: session and token cleared, protected URL returns to the sign-in page | PASS |
| 7 | Account Head signs in through the form: correct identity, Finance dashboard loads (HR data 403 for that token) | PASS, with a caveat: the first load showed the previous HR visit's "load failed" message until "Retry API load" was clicked |
| 8 | Reload with a valid session: stays signed in (role checked with the server) | PASS |
| 9 | Stored role changed to HR while the token is Admin's: after a reload the session is ended and the page goes to the sign-in page | PASS |
| 10 | Rejected token (a valid token with its last characters altered) and page reload: session ended, sign-in page shows "Your session has expired. Please sign in again." | PASS |
| 11 | Token rejected in the middle of a session (page already open): signed out by itself after about 15 s (next background refresh) and sent to the sign-in page | PASS |
| 12 | Task Management still lists the Principal's 5 tasks after the change | PASS |
| 13 | OTP screens | NOT RUN (the frontend has no OTP screen; OTP was checked through the API only) |
| 14 | Change-password screen with the new 10-character rule, and a must-change account | NOT RUN (the client check was edited; the server rule is covered by pytest) |
| 15 | A real expired token (waiting for 8 hours, or a token signed with an old expiry) in the browser | NOT RUN (the server's rejection of an expired token was checked through the API; the browser used an altered token, which takes the same 401 path) |
| 16 | Offline demo sign-in with `VITE_ENABLE_DEMO_LOGINS=true` | NOT RUN |
| 17 | Admissions screen with the new parent password prompt | NOT RUN |
| 18 | Escalation and leave screens | NOT RUN in a browser this round (escalation tests and the live API read for escalations and leave were 200; screens were checked in earlier rounds) |

## Defects found

- **Fixed:** FE fallback logins for HR, Finance (HR, Account Head, Admin) and a pre-filled default parent password; any 6-digit "OTP" accepted by an unused local login; startup with the shipped secret; OTP code and unknown-account disclosure; unlimited login and OTP guessing; 6-character passwords; a wrong-password sign-in falling back to local demo accounts.
- **Not fixed:** the `hr_employees.user_id` column type in the local database (above); the Finance screen keeps a previous user's error after switching users in one tab, and client-side caches (HR, finance and others) are not cleared on sign-out (recommend a full page reload on sign-out in P1); mock employee pages still contain fictional account passwords as display text (they cannot sign in).

## Side effects on this machine

- `backend/.env` (git-ignored, never committed) got `ENVIRONMENT=development` so the backend keeps starting.
- The backend on port 8000 was restarted on the new code.
- Failed-login and OTP audit rows were written to the dev database; the throwaway lockout email does not exist as an account.
- In the browser, the Admin, Teacher and Director test tabs were signed out by the checks; the Principal tab is still signed in.

## Commands

```
cd backend
python -m pytest tests/ -q
```

## Coverage notes

- `tests/test_security_p0.py` (52) — P0 hardening, listed above
- `tests/test_frontend_auth_static.py` (10) — frontend auth source checks (no JS test runner exists in the project)
- `tests/test_escalations_tasks.py` (19) — escalations and tasks incl. hierarchy
- `tests/test_leave.py`, `test_exams.py`, `test_lesson_plans.py`, `test_approvals.py`, `test_students.py`, `test_attendance.py`, admissions, parents/children, finance, HR, Phase 0
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
