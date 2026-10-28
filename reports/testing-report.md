# Testing report

**Date:** 28 October 2026  
**Branch:** local uncommitted work (not pushed)  
**Context:** Staff login provisioning + prior isolated academic UAT. **No live campus DB writes.**

## Staff reconciliation + live provision

| Check | Result |
|---|---|
| Excel body / real staff / hrSeed | **122** / **120** / **120** |
| Eligible / directory-only | **100** / **20** |
| Live dry-run before create | would create **100**, preserve roster matches **0**, prior users **78** |
| Live backup | `backend/local/db_backups/qmis_live_20261028T064211Z.dump` (TOC verified; no CREATEDB for full restore DB) |
| Live create-missing | **100** EMP-QMIS accounts created; **78** prior users preserved |
| Post dry-run | create **0**, preserve **100** EMP-QMIS |
| Handoff | `local/credentials/queen-mira-staff-logins-live.json` (gitignored; no passwords in reports) |
| `tests/test_staff_login_provision.py` + `test_staff_reconciliation.py` | **6 passed** |

Redacted docs: `QMIS_Staff_Reconciliation_Report.md`, `QMIS_Staff_Live_Provision_DryRun.md`, `QMIS_Staff_Live_Provision_Result.md`.

## Earlier same-day — browser UAT (isolated academic flow)

Isolated SQLite API `:8001` + Vite `:5181`. Parent/student portals showed published **UAT Midterm G7 · Maths 46/50 · 92% · A+**. Not school production sign-off.

## Notes

- Live campus provisioning was **not** executed this pass (requires backup + explicit `--i-understand-live`).
- Correction UI still not browser-exercised (API-only feature).
