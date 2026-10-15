# Testing report

Project: Queen Mira International School ERP  
Last run: 15 October 2026 (audit High follow-ups: file IDOR, must_change_password gate, FE hydrate)

| Check | Result |
|---|---|
| `python -m pytest tests/ -q` | **415 passed**, 1 warning (~3 m 1 s) |
| Focused: orphan file + password gate | **PASS** (`test_orphan_uploads_are_not_campus_wide_readable`, `test_strong_password_change_succeeds_and_new_password_works`) |
| Live DB vs ORM | **48** tables, Alembic **`0012_students_student_user_id`**, 0 drift (prior audit) |
| `npm run build` | **PASS** (prior audit; not re-run this slice) |
| Browser E2E | NOT RUN |
| Load / soak | NOT RUN |
| Live email / WhatsApp / payments | NOT RUN (policy) |

Audit document: `backend/docs/SYSTEM_STABILITY_AUDIT_15OCT.md`  
Decision: **READY WITH LIMITATIONS**
