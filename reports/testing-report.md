# Testing report

**Date:** 21 October 2026  
**Branch:** `ERP1`  
**Context:** Partner portal API restore (parents / exams / lesson-plans)

## Backend

| Metric | Count |
|---|---|
| Passed | **451** |
| Failed | **0** |
| Skipped | 0 |
| Warnings | 1 (Starlette TestClient / httpx deprecation) |
| Duration | ~4.3 minutes |

Command: `python -m pytest tests/ -q` from `backend/`.

Restored paths: parents list + children placement, exam update (+ `academic_year`), lesson-plan complete; teacher roster list test handles empty/inactive masters seed.
