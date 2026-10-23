# Testing report

**Date:** 23 October 2026  
**Branch:** `ERP1`  
**Context:** Gate-pass read on the reloaded API, campus dropdowns, and new-login checks

## Backend

| Metric | Count |
|---|---|
| Passed | **460** |
| Failed | **0** |
| Skipped | 0 |
| Warnings | 1 (Starlette TestClient / httpx deprecation) |
| Duration | 3 minutes 38 seconds |

Command: `python -m pytest tests/ -q` from `backend/`.

The gatekeeper read test still passes: a gate account can list a saved student gate pass and cannot create one or read student transfers.

## Frontend

`npm run build` passed (about 51 seconds).

Browser on `http://localhost:5173`: after the local API was started again, the gate-pass page listed 5 saved passes, including student pass DEMO-FO-SGP-001. A new Transport Manager sign-in still showed TN01BRW2222, Browser West Route, and the TN01BRW1111 duty, and those were the only dropdown choices. A new stationery sign-in stayed on the inventory address and still showed Browser graphite pencil. A new canteen sign-in still showed Browser lemon rice. A new IT sign-in still showed Browser lab projector, and the stationery address sent that IT user back to the IT dashboard. No real email, WhatsApp message, or payment was sent.
