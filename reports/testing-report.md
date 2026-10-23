# Testing report

**Date:** 23 October 2026  
**Branch:** `ERP1`  
**Context:** Complete system-wide audit (`QMIS_ERP_COMPLETE_SYSTEM_AUDIT_REPORT.md`)

## Backend

| Metric | Count |
|---|---|
| Passed | **460** |
| Failed | **0** |
| Skipped | 0 |
| Warnings | 1 (Starlette TestClient / httpx deprecation) |
| Duration | 3 minutes 47 seconds |

Command: `python -m pytest tests/ -q` from `backend/`.

## Frontend

`npm run build` passed (about 45 seconds).

## Browser

No new full-role browser matrix in this audit pass. Prior 23 October portal checks remain documented in `REMAINING_MODULES_IMPLEMENTATION_REPORT.md` and are cited as PARTIAL / BLOCKED in the system audit — not re-claimed as PASS.
