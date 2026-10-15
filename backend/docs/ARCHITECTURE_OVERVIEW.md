# QMIS ERP — Architecture overview (Archify)

**Date:** 15 October 2026  
**Architecture diagram:** [`.archify/architecture-project-overview/qmis-erp-overview.html`](../../.archify/architecture-project-overview/qmis-erp-overview.html)  
**Request flow diagram:** [`.archify/sequence-request-lifecycle/qmis-request-flow.html`](../../.archify/sequence-request-lifecycle/qmis-request-flow.html)  
**Candidates:** `.archify/architecture-project-overview/candidate.json`, `.archify/sequence-request-lifecycle/candidate.json`  
**Builder:** `.archify/build_project_overview.py` (scans `app/main.py` routers)  
**Quality:** Archify **showcase** finalize — validate / deliver / check / browser-check **PASS** (architecture + sequence)

---

## What the architecture diagram shows

| Layer | Nodes | Meaning |
|---|---|---|
| People | Browser users | Staff / parent / student roles using the Vite app |
| Frontend | React + Vite web (lazy role layouts), `src/services/*Api.js` | Bearer JWT client to `/api/v1` |
| API core | FastAPI app | Mounted routers from `backend/app/main.py` |
| Live modules | Auth, Audit, Admin users, Masters, Admissions, Parents, Students, Attendance, Workflows (leave/escalations/tasks/approvals/notifications/exams), Finance, HR, Files, **Admin campus**, Front Office | Green “API module” cards |
| Admin campus (`mod_admin_campus`) | Documents, Announcements, Calendar, TC, Activities, Communication, Admin dashboard | Grouped so the rack stays readable |
| Planned | Ops / later modules | Dashed “planned” edges |
| Data | PostgreSQL `qmis_erp`, `uploads/` | SQL + file assets |
| Migrations | Alembic `0001`–`0012` | Schema upgrades (not silent at startup); **48** app tables at head (+ `students.student_user_id`) |

Views in the HTML: **Live API**, **Planned**, **User path**.

---

## Request flow diagram (sequence)

Interactive sequence shows the verified authenticated path:

```
User → React (lazy layout) → apiClient (Bearer JWT)
     → FastAPI → get_current_user + must_change_password gate
     → require_permission (matrix RBAC)
     → domain service → SQLAlchemy SessionLocal → PostgreSQL
     → optional uploads ACL → JSON → UI hydrate
```

Cards on the sequence HTML note 15 Oct hardening (orphan file ACL, attendance/marks write UX, code-split) and what is not assumed (delivery ≠ accept; Director next).

---

## How to regenerate

```bash
# from repo root — architecture (stable folder only)
python .archify/build_project_overview.py
# if browser-check evidence blocks ownership, move the .browser-check.json aside first
node <archify>/bin/archify.mjs finalize architecture `
  .archify/architecture-project-overview/candidate.json `
  .archify/architecture-project-overview/qmis-erp-overview.html `
  --repo-root . --quality showcase --json

# request lifecycle sequence
node <archify>/bin/archify.mjs finalize sequence `
  .archify/sequence-request-lifecycle/candidate.json `
  .archify/sequence-request-lifecycle/qmis-request-flow.html `
  --repo-root . --quality showcase --json
```

Open the HTML files in a browser (dark/light themes, export PNG/SVG from the diagram UI if needed).

---

## Related docs

| Doc | Purpose |
|---|---|
| `DATABASE_ARCHITECTURE_RULES.md` | Rules for all 480 sidebar modules (reuse first; migrate only when needed) |
| `MODULE_DOMAIN_MAPPING.md` | Role module → API → tables map (Admin 26 + PRM 21 + Parent 23 + Student 23 + Teacher/Coord + Principal 21; baseline 48 tables @ `0012`) |
| `SYSTEM_STABILITY_AUDIT_15OCT.md` | Stability audit go/no-go |
| `ADMINISTRATOR_MODULE_AUDIT.md` | Admin 26-module E2E scorecard |
| `DATABASE_INTEGRATION_AUDIT.md` | DB, config inventory, persistence, authz |
| `FRONTEND_INTEGRATION.md` | Route and flag details |
| `reports/daily-work-report.md` | Daily progress (markdown SoT) |

---

## Delivery gate (15 Oct)

**Completed panels:** Administrator **26/26**, PRM **21/21**, Parent **23/23**, Student **23/23**, Teacher **29/1 Gap**, Coordinator **29/1 Gap**, Principal **21/21**.  
**Stability audit:** [`SYSTEM_STABILITY_AUDIT_15OCT.md`](SYSTEM_STABILITY_AUDIT_15OCT.md) → **READY WITH LIMITATIONS** (Alembic **0012**, **48** tables; High + Medium follow-ups pushed).  
**Pytest:** **416 passed** (15 Oct refresh).  
Next delivery slice: Director panel.
