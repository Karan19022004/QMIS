# Testing report

Project: Queen Mira International School ERP  
Last run: 14 October 2026 (Parent Announcement + TC live)  
Result: `tests/test_parent_announcements.py` + `tests/test_parent_tc_requests.py` → **4 passed**, 1 warning (~9 s).

Live (uvicorn reloaded): Parent TC create **201**, forward **403**; Parent `GET /announcements` **200** (notices visible).

## Decision

Parent TC + Announcement verified. Next: Parent Calendar.
