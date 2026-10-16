# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 (PRM Front Office regression)

| Check | Result |
|---|---|
| Live FO API CRUD × 6 collections (marker create → DB → delete) | **PASS** |
| RBAC unauth 401 / teacher 403 / principal read 200 write 403 / PRM write 201 | **PASS** |
| Admissions + enquiries still 200 | **PASS** |
| `pytest tests/test_front_office_api.py` | **PASS** — **11 passed** |
| Browser PRM login + Admission Enquiry | **PASS** |
| Browser Material Gate Pass list (after hydrate fix) | **PASS** — showed API `BrowserDriver` / `TN-BR-9999` |
| Browser Student Transfer list | **PASS** — showed `Browser Transfer Kid` after Clear Filters |
| Full pytest suite / lint / production build | **NOT RUN** this pass |
| Main Word unlock / overwrite | **NOT RUN** (preserved) |

Hardening applied (uncommitted until approved): PRM seed, principal/director `frontoffice.read`, Material/Goods/Re-enrollment list API hydrate.

Decision: **PRM READY** (21/21 retained with evidence). **Director next** — first task Exam Timetable Approvals.
