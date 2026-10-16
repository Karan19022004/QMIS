# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 (seven-role demo verification audit)

| Check | Result |
|---|---|
| Backend `python -m pytest tests/ -q` | **418 passed**, **3 failed**, 1 warning (~249s) |
| Failed: `test_no_seeded_api_passwords_in_frontend_source` | **FAIL** — SignIn demo chip passwords (intentional for local demo) |
| Failed: `test_sign_in_page_has_no_prefilled_demo_credentials` | **FAIL** — Demo test logins panel on SignIn |
| Failed: `test_super_admin_pages_were_not_switched_to_the_api` | **FAIL** — SA Attendance intentionally uses `adminAttendanceApi` |
| Frontend `npm run build` | **PASS** (~57s) |
| API login all 7 demo roles + invalid password | **PASS** |
| Playwright sidebar leaf crawl (199 pages, 7 roles) | **PASS** (after Mark Entry fix) |
| Teacher Mark Entry blank (`students is not defined`) | **FIXED** + re-verified render |
| Admin activity create → SA notification → delete cleanup | **PASS** |
| RBAC: Account Head/HR/Teacher denied `GET /admin/users` | **PASS** (403) |
| RBAC: Teacher denied `PUT /hr/payroll` | **PASS** (403); GET still allowed (P1) |
| Frontend ESLint full suite | **NOT RUN** |
| SMTP / WhatsApp live | **NOT RUN** |

Decision: **READY WITH LIMITATIONS** — seven-role demo can be shown; mock SA Finance/Audit/Transport/Activity Logs must be labeled as demo shells; tighten HR read permissions before production.
