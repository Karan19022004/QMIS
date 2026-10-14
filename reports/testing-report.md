# Testing report

Project: Queen Mira International School ERP  
Last run: 14 October 2026 (PRM Front Office completion)  
Result: full `backend/tests/` **402 passed**, 1 warning, ~3 m 10 s. Alembic **`0011_front_office_records`**.

Live API (uvicorn restarted): create student gate pass **201** (`SGP-0001`) → list contains row → delete **204**; teacher `/front-office/*` **403**; `GET /tc-requests` **200**.

PRM role-module status: **21 Completed / 0 Partial / 0 Not Completed** (`QMIS-ERP-Role-Module-Status.updated.14oct-prm.docx`). TOTAL sheet: 151 Completed / 46 Partial / 281 Not Completed / 2 Gap.

## Decision

**PRM Front Office modules completed** — pytest + live persistence/authz smoke PASS.
