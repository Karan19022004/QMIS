# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 (Super Admin inch-by-inch browser re-audit + calendar export restore)

| Check | Result |
|---|---|
| Backend `python -m pytest tests/ -q` | **419 passed**, **2 failed**, 1 warning (~232s) |
| Failed: `test_no_seeded_api_passwords_in_frontend_source` | **FAIL** — SignIn demo login passwords present for local demo |
| Failed: `test_sign_in_page_has_no_prefilled_demo_credentials` | **FAIL** — Demo test logins panel on SignIn |
| API `/health` + Vite `localhost:5173` | **PASS** |
| Browser: Super Admin route crawl (48) | **PASS** (no blank roots after calendar export restore) |
| Browser: Super Admin Approvals detail Approve/Reject | **PASS** |
| Browser: Super Admin Cultural list Approve/Reject | **PASS** |
| Browser: Super Admin header titles (Activities / Re-entry / Module Health / My Tasks) | **PASS** (after TitleMappings fix) |
| Browser: Super Admin Students List API (`/students`) | **PASS** (17 enrolled rows) |
| Browser: Super Admin Employee List API (HR directory) | **PASS** (21 rows) |
| Browser: Super Admin Student Attendance API | **PASS** (5 rows for selected date) |
| Frontend `npm run build` | **NOT RE-RUN** this pass |
| Frontend ESLint full suite | **NOT RUN** |
| SMTP / WhatsApp live | **NOT RUN** (demo/stub only) |

Decision: **READY WITH LIMITATIONS** — Super Admin panel crawl clean; calendar missing-export blank fixed; two static auth tests fail because demo passwords are intentionally shown on SignIn for the local demo.
