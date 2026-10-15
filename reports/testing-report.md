# Testing report

Project: Queen Mira International School ERP  
Last run: 15 October 2026 (Principal panel + prior High audit follow-ups)

| Check | Result |
|---|---|
| `python -m pytest tests/test_principal_portal_apis.py` | **1 passed** |
| Focused portal + security regression | **6 passed** (principal/coordinator/teacher + password gate + orphan file) |
| Prior full suite (High follow-ups) | **415 passed** |
| Live DB vs ORM | **48** tables, Alembic **`0012_students_student_user_id`** |
| Browser E2E | NOT RUN |
| Load / soak | NOT RUN |
| Live email / WhatsApp / payments | NOT RUN (policy) |

Word: Principal **21/21 Completed**; TOTAL **267 / 27 / 184 / 2**  
Decision: **READY WITH LIMITATIONS** (Medium items still open)
