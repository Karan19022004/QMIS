# Testing report

Project: Queen Mira International School ERP  
Last run: 14 October 2026 (Administrator Documents, Notifications, Announcements, Calendar, TC, Activities, Communication, Dashboard)  
Result: **400 passed**, 1 warning (Starlette/httpx TestClient deprecation), 4 m 6 s. That is the full `backend/tests/` suite after the remaining Administrator modules. New-module suites alone were **83 passed** earlier the same evening.

Frontend: ESLint on the new service and Admin Dashboard / TC / Notification files is clean (one pre-existing exhaustive-deps warning on the TC list). Documents files were lint-clean at commit `cd2ec2f`.

Evidence is kept apart. **Automated** = pytest. **Browser** = I drove the real screen against the running backend and the real development database. Anything not run is marked NOT RUN.

## Administrator remaining modules (14 Oct 2026 evening)

**Automated (pytest) — PASS.** Full suite `python -m pytest tests/ -q`: **400 passed**, 1 warning, 4 m 6 s. Related new-module suites earlier the same evening: **83 passed** (Documents, announcements, calendar / TC / activities / communication / dashboard, migrations `0005`–`0010`, static announcement + notification guards).

**Browser — Administrator, live backend, real development database:**

| # | Scenario | Result |
|---|---|---|
| B1 | Documents: pick ADM-0001, upload four files, list Completed, View file (blob), replace TC (old 404, new bytes match), employee EMP-0016 Offer Letter, approve status | PASS (earlier today) |
| B2 | Phase 0: Leave/Escalation pages do not write `schoolerp-leave-requests` / `schoolerp-escalations` in API mode; stale escalation key purged | PASS (earlier today) |
| B3 | Dashboard `/dashboard` shows live counts (10 students, 17 employees, 1 leave, 0 open escalations, 0 pending TC, 2 announcements this month) | PASS |
| B4 | Calendar Upcoming after hydrate: Annual Sports Day, Diwali, Unit Test | PASS |
| B5 | Announcement list shows AN-0001 and AN-0002 from the server | PASS |
| B6 | Notifications page + header bell use `/notifications` | PASS (header); Admin page mapping PASS (code + API 200) |
| B7 | Teacher/HR denial on new screens in the browser | NOT RUN (pytest 403) |
| B8 | Communication send / TC approve in the browser | NOT RUN |
| B9 | Activities add + chess results in the browser | NOT RUN |
| B10 | Frontend production build after this evening's wiring | PASS (`vite build`, 54 s, existing large-chunk warning) |

**Defects found and fixed during the browser run:** `/dashboard` was redirected to Admissions because Admin routes require a `/admin` prefix; `App.jsx` now allows `/dashboard` so the existing sidebar link works. Calendar first paint was empty because the in-memory list was read before the server answered; the page now holds the fetched rows in state.

**NOT RUN:** Teacher, HR, Parent on these screens in the browser; Communication attach/send; TC file/forward/approve on screen; Activities create; mobile layout; status-sheet / Archify regeneration.
