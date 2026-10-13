# Testing report

Project: Queen Mira International School ERP  
Last run: 12 October 2026 (P1-5 + Y-1)  
Result: **50 passed**, 0 failed (full suite `backend/tests/`)

## Commands

```
cd backend
python -m pytest tests/ -q
```

## Coverage notes

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
