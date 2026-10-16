# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 (five-role module audit + regression)

| Check | Result |
|---|---|
| Backend `python -m pytest tests/ -q` | **421 passed**, 1 warning (~205s) |
| Frontend `npm run build` | **PASS** (~46s) |
| API `/health` + Vite `localhost:5173` | **PASS** |
| PostgreSQL + Alembic | **PASS** (`0012_students_student_user_id`; students 17, hr_employees 19) |
| Live five-role API smoke (58 checks) | **57 PASS**, 1 expected RBAC deny (Principal `/tc-requests` → 403 — no Principal TC menu) |
| HR: employees, documents, jobs, candidates, leave, payroll, attendance, training, performance, claims | **PASS** |
| HR: create staff + login + document Pending→Verified | **PASS** |
| Admin: students, dashboard, announcements, calendar, tasks, leave, TC, notifications, escalations, communication | **PASS** |
| Admin/PRM: `/admissions/enquiries` | **PASS** (14 rows; wrong path `/admission-enquiries` is 404) |
| Teacher: students, tasks, leave, announcements, exams, notifications, FO 403 | **PASS** |
| PRM: all 6 FO collections + create/delete audit gate pass | **PASS** |
| Principal: employee directory (19), students, announcements, calendar, leave, exams; HR staff create 403 | **PASS** |
| Communication: Admin→Teacher message creates inbox unread + notification | **PASS** |
| Demo seed `scripts/demo_seed_evening.py` | **PASS** (idempotent; earlier this day) |
| Browser click-through every sidebar control | **NOT RUN** (API + code path verified; full UI tour not automated) |
| Frontend ESLint full suite | **NOT RUN** |
| SMTP / WhatsApp live | **NOT RUN** (demo/stub only) |

Decision: **READY WITH LIMITATIONS** — five-role APIs and regression green; residual PARTIAL screens called out in the daily work report.
