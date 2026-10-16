# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 (Super Admin notification connection check)

| Check | Result |
|---|---|
| Backend `python -m pytest tests/ -q` | **419 passed**, **2 failed**, 1 warning (~232s) — unchanged from earlier today |
| Failed: `test_no_seeded_api_passwords_in_frontend_source` | **FAIL** — SignIn demo login passwords present for local demo |
| Failed: `test_sign_in_page_has_no_prefilled_demo_credentials` | **FAIL** — Demo test logins panel on SignIn |
| API `/health` + Vite `localhost:5173` | **PASS** (backend restarted for this check) |
| API: SA `GET /notifications` | **PASS** (2 rows after Admin activity create) |
| API: Admin `POST /activities` → SA role notify | **PASS** (`Activity approval needed: Notify SA Connection Test`) |
| Browser: Super Admin Notifications page (API connected banner + 2 rows) | **PASS** |
| Browser: Super Admin header bell badge + dropdown + View all | **PASS** (badge **2**) |
| Browser: Super Admin route crawl (48) | **PASS** (earlier today) |
| Browser: Super Admin Students / Employees / Attendance / Gate Pass | **PASS** (earlier today) |
| Frontend `npm run build` | **NOT RE-RUN** this pass |
| Frontend ESLint full suite | **NOT RUN** |
| SMTP / WhatsApp live | **NOT RUN** (demo/stub only) |

Decision: **READY WITH LIMITATIONS** — Super Admin notifications are API-connected end-to-end (page + bell + activity create → SA inbox). Two static auth tests still fail because demo passwords are shown on SignIn.
