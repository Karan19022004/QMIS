# QMIS ERP — Architecture overview (Archify)

**Date:** 14 October 2026  
**Interactive diagram:** [`.archify/architecture-project-overview/qmis-erp-overview.html`](../../.archify/architecture-project-overview/qmis-erp-overview.html)  
**Candidate source:** `.archify/architecture-project-overview/candidate.json`  
**Builder:** `.archify/build_project_overview.py` (scans `app/main.py` routers)  
**Quality:** Archify **showcase** finalize — validate / deliver / check / browser-check **PASS**

---

## What the diagram shows

| Layer | Nodes | Meaning |
|---|---|---|
| People | Browser users | Staff/parent roles using the Vite app |
| Frontend | React + Vite web, `src/services/*Api.js` | Bearer JWT client to `/api/v1` |
| API core | FastAPI app | Mounted routers from `backend/app/main.py` |
| Live modules | Auth, Audit, Admin users, Masters, Admissions, Parents, Students, Attendance, Workflows (leave/escalations/tasks/approvals/notifications), Finance, HR, Files, **Admin campus** | Green “API module” cards |
| Admin campus (`mod_admin_campus`) | Documents, Announcements, Calendar, TC, Activities, Communication, Admin dashboard | Grouped so the rack stays readable |
| Planned | Ops / later modules | Dashed “planned” edges |
| Data | PostgreSQL `qmis_erp`, `uploads/` | SQL + file assets |
| Migrations | Alembic `0001`–`0010` | Schema upgrades (not silent at startup) |

Views in the HTML: **Live API**, **Planned**, **User path**.

---

## Connection path (runtime)

```
User → Vite (:5173) → apiClient (VITE_API_BASE_URL)
     → FastAPI (:8000) + JWT + permission matrix
     → SQLAlchemy session → PostgreSQL
     → optional files under UPLOAD_DIR
```

Startup also runs `create_all` for **missing** tables only, legacy column helpers, `warn_if_schema_behind()`, then seeds. Schema upgrades that alter columns require `alembic upgrade head` (see `DATABASE_INTEGRATION_AUDIT.md`).

---

## How to regenerate

```bash
# from repo root
python .archify/build_project_overview.py
# if browser-check evidence is owned/stale, remove the .browser-check.json first
node <archify>/bin/archify.mjs finalize architecture `
  .archify/architecture-project-overview/candidate.json `
  .archify/architecture-project-overview/qmis-erp-overview.html `
  --repo-root . --quality showcase --json
```

Open the HTML in a browser (dark/light themes, export PNG/SVG from the diagram UI if needed).

---

## Related docs

| Doc | Purpose |
|---|---|
| `ADMINISTRATOR_MODULE_AUDIT.md` | Admin 26-module E2E scorecard |
| `DATABASE_INTEGRATION_AUDIT.md` | DB, config inventory, persistence, authz |
| `FRONTEND_INTEGRATION.md` | Route and flag details |
| `reports/daily-work-report.md` | Daily progress (markdown SoT) |
| `erp complete documentation/QMIS-ERP-Daily-Work-Report.pdf` | Manager PDF of the daily report |

---

## Delivery gate (14 Oct)

Administrator modules are **READY WITH KNOWN LIMITATIONS**. Next delivery slice is **PRM (Front Office)** — start with Admission Enquiry against the existing admissions API; do not expand Archify until that slice lands new routers.
