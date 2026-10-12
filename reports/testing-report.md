# Testing report

Project: Queen Mira International School ERP  
Last run: 12 October 2026 — admissions A1–A8 unblock  
Result: **admissions pytest 2 passed**; full suite not re-run this slice

## Commands

```
cd backend
python -m pytest tests/test_admissions.py -q
```

## Admissions (A1–A8) API

| Case | Result | Evidence |
|---|---|---|
| GET `/admissions/enquiries` | PASS | Was 500 (null enquiry_code); fixed + migrate backfill |
| POST `/admissions/enquiries` | PASS | Was 500 (guardian_name NOT NULL); default + migrate |
| Convert enquiry → admission | PASS | Live probe ADM-0002 |
| Enroll + parent login create | PASS | Live probe 200; clash with legacy ADM-0001 handled |
| Browser manual A1–A8 | NOT CLAIMED | User retest required |

## Honesty

| Item | Status |
|---|---|
| Root cause of “nothing works” on Admin admissions | API 500s from Phase-0 schema drift |
| Manual UI Pass/Fail | Awaiting user |
