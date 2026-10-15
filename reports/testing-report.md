# Testing report

Project: Queen Mira International School ERP  
Last run: 15 October 2026 (safe structure cleanup)

| Check | Result |
|---|---|
| `python -m pytest tests/ -q` | **416 passed**, 1 warning (~3 m 51 s) — **PASS** |
| `npm run build` | **PASS** (~57 s; chunk-size warnings only) |
| `npm run lint` | **NOT RUN** |
| Alembic / live PostgreSQL connectivity | **NOT RUN** (no destructive DB ops in this cleanup) |
| Browser E2E | **NOT RUN** |
| Load / soak | **NOT RUN** |

Secret scan (working tree commit set): removed tracked `cred.txt` from index; `.env` remains ignored.  
Diagrams: `.archify/architecture-project-overview/qmis-erp-overview.html` (single current).

Decision: **READY WITH LIMITATIONS** — structure cleanup safe; Director / Principal Partials next
