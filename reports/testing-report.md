# Testing report

Project: Queen Mira International School ERP  
Last run: 14 October 2026 (PRM Goods Received Pass + Word status)  
Result: `tests/test_front_office_api.py` → **6 passed**, 1 warning (~8 s). Alembic **`0011_front_office_records`**.

Live API: `POST /front-office/goods-received-passes` → **201** (`GRP-0001`).

Word: PRM **21 Completed / 0 Partial / 0 Not Completed**; TOTAL 151 / 46 / 281 / 2 Gap.

## Decision

PRM Front Office campus create/update flows complete and marked Completed in the role-module status Word files.
