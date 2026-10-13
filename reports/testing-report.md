# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (Y-0 approvals, Y-2 lesson plans, Y-3 exams/marks, Y-4 leave, Y-5 escalations/tasks)  
Result: **79 passed**, 0 failed (full suite `backend/tests/`)  
Also run: frontend production build (passes); frontend-vs-backend endpoint comparison (logout route fixed); manual browser check of the leave workflow (teacher → principal → HR, with bell notifications) against the live backend — passed, one UI bug fixed (see daily report)

## Commands

```
cd backend
python -m pytest tests/ -q
```

## Coverage notes

- `tests/test_escalations_tasks.py` — escalation goes one level up, receiver-only status changes, note required to resolve, raiser-only close, trail order; named recipient must hold the right role; 24h clock (nothing at 23h, moves at 25h, idempotent, multiple levels in one sweep, old owner keeps read but loses action); top-level overdue alert once; HR has no path; sweep is admin-only; task assign/status flow (only assignee, no reopen), validation (past date, priority, self-assign, box access), overdue alert once and never for completed tasks
- `tests/test_leave.py` — teacher chain principal→HR with received-box visibility; on-leave lookup; permission rules (hours, one day, type); overlap 409; deny needs reason then re-file; access rules incl. approval bypass blocked; logout audited
- `tests/test_exams.py` — default/custom exam types and permissions; marks blocked until exam approved; draft edit then lock; publish only after full chain; ranks, class-high, percentage; parent sees own child only (other family 404); validation (max, wrong class, absent, duplicate); deny then revise v2; weightage permission, sum=100, weighted final, lock after cycle start
- `tests/test_lesson_plans.py` — deadline rule; create/edit/submit/lock; duplicate 409; full approval and visibility; deny then revise to v2; late flag and month validation; reminder window and idempotency; reminder permission
- `tests/test_approvals.py` — full 3-level chain + notifications; wrong role / self-decision 403; deny needs reason, resubmit keeps history; submit role check, custom chain validation; notification read
- `tests/test_students.py` — campus list/detail; parent 403; teacher `students.read`
- `tests/test_attendance.py` — upsert/list/roster/calendar; teacher `attendance.write`
- Prior: admissions, parents/children, finance, HR, Phase 0
- Pytest ≠ browser Pass for Student Database / Class Attendance UI

## Seeded API logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@qmis.edu | admin123 |
| Teacher | teacher@qmis.edu | teacher123 |
| Coordinator | coordinator@qmis.edu | coord123 |
| Principal | principal@qmis.edu | principal123 |
| Director | director@qmis.edu | director123 |
