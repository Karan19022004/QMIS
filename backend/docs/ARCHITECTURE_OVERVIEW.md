# QMIS ERP — Architecture overview (Archify)

**Date:** 15 October 2026  
**Archify version:** **3.1.0** (doctor ready)  
**Single current diagram:** [`.archify/architecture-project-overview/qmis-erp-overview.html`](../../.archify/architecture-project-overview/qmis-erp-overview.html)  
**Candidate source:** `.archify/architecture-project-overview/candidate.json`  
**Builder:** `.archify/build_project_overview.py` (scans `app/main.py` routers)  
**Quality:** Archify **showcase** finalize — validate / deliver / check / browser-check **PASS**

Do not maintain a second “current” Archify HTML. Specialized types (below) are available in the skill for future slices only.

---

## Archify 3.1.0 diagram types

| Type | Role in this project |
|---|---|
| **architecture** | **Current SoT** — project overview (this HTML) |
| workflow | Available — process / approval runbooks when needed |
| sequence | Available — call chains when needed (not a second current file) |
| dataflow | Available — pipelines / lineage when needed |
| lifecycle | Available — state machines when needed |
| **erd** | **New in 3.1** — entity relationships when needed |
| **tree** | **New in 3.1** — hierarchies when needed |
| **class** | **New in 3.1** — type / interface maps when needed |
| **timeline** | **New in 3.1** — chronology when needed |
| **waterfall** | **New in 3.1** — staged delivery when needed |

---

## What the overview shows

| Layer | Nodes | Meaning |
|---|---|---|
| People | Browser users | Staff / parent / student roles using the Vite app |
| Frontend | React + Vite (lazy role layouts), `src/services/*Api.js` | Bearer JWT client to `/api/v1` |
| API core | FastAPI app | Mounted routers from `backend/app/main.py` |
| Live modules | Auth, Audit, Admin users, Masters, Admissions, Parents, Students, Attendance, Workflows, Finance, HR, Files, Admin campus, Front Office | API module cards |
| Data | PostgreSQL `qmis_erp`, `uploads/` | SQL + file assets |
| Migrations | Alembic `0001`–`0012` | **48** app tables at head |

Views: **Live API**, **Planned**, **User path** (request flow).

---

## Request path (in overview User-path view)

```
User → Vite (:5173, lazy layout) → apiClient (Bearer JWT, VITE_* flags)
     → FastAPI (:8000) + get_current_user / must_change_password + RBAC matrix
     → domain service → SQLAlchemy → PostgreSQL qmis_erp (+ uploads ACL)
```

---

## How to regenerate (one file)

```bash
# from repo root
python .archify/build_project_overview.py
# if browser-check evidence blocks ownership, move the .browser-check.json aside first
node <archify>/bin/archify.mjs finalize architecture `
  .archify/architecture-project-overview/candidate.json `
  .archify/architecture-project-overview/qmis-erp-overview.html `
  --repo-root . --quality showcase --json
```

Manager daily PDF (from markdown SoT):  
`python "erp complete documentation/make_daily_work_report_pdf.py"`  
→ `erp complete documentation/QMIS-ERP-Daily-Work-Report.pdf`

---

## Delivery gate (15 Oct)

**Completed panels:** Administrator **26/26**, PRM **21/21**, Parent **23/23**, Student **23/23**, Teacher **29/1 Gap**, Coordinator **29/1 Gap**, Principal **21/21**.  
**Stability:** READY WITH LIMITATIONS · Alembic **0012** · **48** tables · pytest **416 passed**.  
**Next:** Director panel.
