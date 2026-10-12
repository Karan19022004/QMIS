# Testing report

Project: Queen Mira International School ERP  
Last run: 12 October 2026 — P1-4 parents/me/children  
Result: **3 passed** (admissions + e2e); live smoke parent children **PASS**

## Commands

```
cd backend
python -m pytest tests/test_admissions.py tests/test_e2e_campus_flow.py -q
python scripts/smoke_parent_login.py
```

## Results

| Case | Result |
|---|---|
| Enquiry → convert → enroll → parent login | PASS |
| `GET /parents/me/children` returns enrolled child | PASS (pytest + live smoke) |
| Browser Select Child UI | Fix shipped — user retest |

## Latest smoke parent (for UI)

```
email:    smoke.parent.311139e0@example.com
password: parent12
```

## Honesty

Manual browser Pass not claimed until user confirms child card appears on `/parent/select-child`.
