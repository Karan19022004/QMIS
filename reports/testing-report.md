# Testing report

Project: Queen Mira International School ERP  
Last run: 14 October 2026 (Administrator end-to-end audit)  
Result: **400 passed**, 1 warning (Starlette/httpx TestClient deprecation), 4 m 55 s — full `backend/tests/` suite.

Live Administrator module matrix (`backend/scripts/audit_admin_modules.py`): **26/26 PASS** (admin read 2xx; teacher 403 on Dashboard, TC, Documents, RBAC users/roles).

Frontend: `npm run build` **PASS** (~57 s). ESLint on Admin API wiring: 0 errors, 1 existing warning on TC list.

Full module-by-module evidence, security checks, browser PASS vs NOT RUN, and Go/No-Go: `backend/docs/ADMINISTRATOR_MODULE_AUDIT.md`.

## Browser (Administrator, live backend, real development database)

| Scenario | Result |
|---|---|
| Documents upload/replace/view | PASS (earlier 14 Oct) |
| Dashboard live KPIs | PASS (earlier 14 Oct) |
| Calendar Upcoming hydrate | PASS (earlier 14 Oct) |
| Announcement list/create/ack/reply | PASS (earlier 14 Oct) |
| Notifications bell + mark-read | PASS (earlier 14 Oct) |
| Class Details CRUD | PASS (earlier 14 Oct) |
| Activities / TC / Communication UI create-send-approve | NOT RUN (live API create/forward/approve/send PASS) |
| Teacher denial in browser | NOT RUN (live API 403 PASS) |

## Decision

**READY WITH KNOWN LIMITATIONS** — see audit §9 (Roles read-only, Documents list Delete stub, Admin Attendance read-only, notification deep-link, other role panels not re-audited).
