# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 (browser-level five-role audit + export wiring + regression)

| Check | Result |
|---|---|
| Backend `python -m pytest tests/ -q` | **421 passed**, 1 warning (~247s) |
| Frontend `npm run build` | **PASS** (~73s; after fixing broken EXPORT_ROWS literals) |
| API `/health` + Vite `localhost:5173` | **PASS** |
| Browser: HR sidebar leaf routes (36) | **PASS** (titles render; no crash banners) |
| Browser: HR employees Export CSV (20 records) | **PASS** |
| Browser: HR attendance status change + refresh | **PASS** (Present persisted with “Was Late”) |
| Browser: Admin sidebar sample (25 routes) | **PASS** (no crash; some headings still generic “School ERP”) |
| Browser: Teacher sidebar leaf routes (30) | **PARTIAL** (most render; late-crawl blanks were race; hard-nav `/teacher/unit-tests` OK) |
| Browser: Teacher class-attendance Export | **PASS** (earlier in session; 5 records CSV) |
| Browser: PRM / Front Office sidebar (21) | **PASS** |
| Browser: Principal sidebar (21) | **PASS** |
| Onboarding password delivery (API; secret not logged) | **PASS** (`temporaryPassword` returned to creator; comms status `DEMO_SENT`) |
| RBAC: Principal `/tc-requests` | **PASS** (403 expected) |
| Frontend ESLint full suite | **NOT RUN** |
| SMTP / WhatsApp live | **NOT RUN** (demo/stub only) |

Decision: **READY WITH LIMITATIONS** — browser sidebar crawl for five roles completed; export wiring expanded on five-role screens; Teacher/Principal localStorage academic modules remain PARTIAL for multi-user SoT.
