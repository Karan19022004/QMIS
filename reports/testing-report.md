# Testing report

Project: Queen Mira International School ERP  
Last run: 15 October 2026 (Principal panel build)

| Check | Result |
|---|---|
| `python -m pytest tests/ -q` | **416 passed**, 1 warning (~4 m 16 s) |
| `tests/test_principal_portal_apis.py` | **1 passed** (exams write, calendar POST, leave boxes, HR employees) |
| Browser E2E | NOT RUN |
| Load / soak | NOT RUN |

Diagrams:  
- `.archify/architecture-project-overview/qmis-erp-overview.html` (single current)

Decision: **READY WITH LIMITATIONS** — Principal **16 Completed / 5 Partial**; Director panel next
