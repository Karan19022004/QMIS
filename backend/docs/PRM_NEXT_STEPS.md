# PRM (Front Office) — status (14 Oct 2026 evening)

**Status sheet:** `erp complete documentation/QMIS-ERP-Role-Module-Status.updated.14oct-prm.docx`  
**Counts:** 21 Completed / 0 Partial / 0 Not Completed / 0 Gap

## What landed

| Area | Implementation |
|---|---|
| Announcement / Calendar / Communication | Existing Common + APIs (`roleKey=prm`) |
| Notifications | PRM page → `GET /notifications` |
| TC Request | Hydrate + forward + `POST …/reject-prm` |
| Teacher Database | Employee directory API + `hr.employees.read` |
| My Attendance | `GET /hr/attendance` + `hr.self` |
| Gate passes / Transfer / Re-enrollment | `front_office_records` + `/api/v1/front-office/*` (migration `0011`) |

## Operator notes

1. Restart uvicorn after pull so `/api/v1/front-office` is mounted.
2. If Word had `updated.14oct-evening.docx` open/locked, use **`updated.14oct-prm.docx`** as the current sheet.
3. Recommended browser smoke as PRM: create student gate pass, forward a TC, open announcements/calendar.

## Follow-ups (non-blocking)

- Wire Add Student Transfer form submit to `student-transfers` if it still saves locally.
- Ensure hostel/material/goods list screens call hydrate on mount (data layer supports API; some lists may still need a `useEffect` hydrate like student gate pass).
