# Testing report

Project: Queen Mira International School ERP  
Last run: 15 October 2026 (Archify refresh + full suite)

| Check | Result |
|---|---|
| `python -m pytest tests/ -q` | **416 passed**, 1 warning (~4 m 13 s) |
| Archify architecture finalize | **PASS** (showcase) |
| Archify sequence finalize | **PASS** (showcase) |
| `npm run build` (Medium code-split) | **PASS** (prior; entry ~354 kB) |
| Browser E2E | NOT RUN |
| Load / soak | NOT RUN |

Diagrams:  
- `.archify/architecture-project-overview/qmis-erp-overview.html`  
- `.archify/sequence-request-lifecycle/qmis-request-flow.html`  

Decision: **READY WITH LIMITATIONS** (Director panel next)
