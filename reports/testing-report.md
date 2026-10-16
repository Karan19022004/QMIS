# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 (UI sync + export + demo seed)

| Check | Result |
|---|---|
| Backend `python -m pytest tests/ -q` | **421 passed**, 1 warning (204s) |
| Frontend `npm run build` | **PASS** (~49s) |
| Demo seed `python scripts/demo_seed_evening.py` (run twice) | **PASS** (idempotent) |
| Live API: Admin students list | **PASS** (17 incl. DEMO-ADM-*) |
| Live API: PRM student gate passes | **PASS** (DEMO-FO-SGP-001 present) |
| Live API: Teacher my tasks | **PASS** (6, incl. [DEMO] titles) |
| Live API: TC requests | **PASS** (5, incl. TC-DEMO-*) |
| Export helpers unit / browser download open | **PARTIAL** — ExportModal + CSV/Excel/PDF wired on demo lists; browser file-open not automated this pass |
| Attendance mark → UI without refresh | **CODE FIXED** (ClassAttendance already save+reload); browser re-click **NOT RUN** this pass |
| Leave / TC approve busy + toast + state | **CODE FIXED**; live browser decide **NOT RUN** this pass |
| SMTP / WhatsApp live send | **NOT RUN** (out of scope) |
| Frontend ESLint full suite | **NOT RUN** |

Decision: **READY WITH LIMITATIONS** for tonight’s five-role demo (sync/export/seed land; some browser spot-checks still manual).
