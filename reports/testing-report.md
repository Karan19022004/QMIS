# Testing report

Project: Queen Mira International School ERP  
Last run: 13 October 2026 (Task Management API integration, on top of Y-0 … Y-5)  
Result: **90 passed**, 0 failed (full suite, `python -m pytest tests/ -q` from `backend`; 82 before this work, plus 8 new tests)  
Frontend: production build passes (exit 0). Lint: `src/services` is clean; `src/Common/TaskManagement` reports 4 errors that were already there (unused `toDate` / `setToDate` in `AssignTasksPage.jsx` line 33 and `MyTasksPage.jsx` line 27, not touched). Whole project: 364 problems (310 errors, 54 warnings), all in other files.

Three kinds of evidence are kept apart. **Automated** = pytest. **Browser** = I drove the real screens against the live backend (Principal, Teacher, Director and Admin each logged in in their own tab). **API probe** = a direct call to the live backend, not a screen. Anything not run is marked NOT RUN.

## Automated (pytest) — Task Management

`tests/test_escalations_tasks.py`: 19 passed (it holds the escalation and the task tests).

| New / changed test | What it proves | Result |
|---|---|---|
| `test_task_status_remark_is_persisted_in_history_with_actor` | Remark is stored with the status change, appears in the task history with actor and role, shows on the list, and is in the completion notification | PASS |
| `test_task_remark_validation_and_rules_unchanged` | Blank remark treated as none; over 2000 characters refused; assignee-only, no-reopen and forward-only rules unchanged | PASS |
| `test_task_create_with_client_ref_is_idempotent` | Same `clientRef` returns the same task (200, `idempotentReplay`); same ref with another assignee is 409; no second task or notification | PASS |
| `test_overdue_notification_is_claimed_atomically_by_one_request` | Two requests racing on the overdue check send exactly one notification per person (this failed with the guard disabled) | PASS |
| `test_task_hierarchy_allows_only_direct_reports` | Allowed: principal→coordinator/teacher, director→principal, admin→director. Refused with 403 and nothing created or notified: principal→director/admin, director→teacher/coordinator, admin→teacher/principal, teacher, coordinator and HR as assigners | PASS |
| `test_task_hierarchy_checks_do_not_change_existing_error_codes` | Self-assignment still 400, bad priority still 400, unknown assignee still 400 | PASS |
| `test_task_hierarchy_applies_to_idempotent_retries` | A refused pairing with a `clientRef` stays refused; the allowed one still replays | PASS |
| `test_task_assignees_are_limited_to_the_callers_direct_reports` | Assignee lookup returns only the caller's direct reports; another role 403; roles that cannot assign (teacher, coordinator, HR) 403 | PASS |
| Existing task tests (assign flow, validation, overdue-once) | Unchanged behaviour | PASS |

Full suite after the hierarchy change: 90 passed, 0 failed (83 s).

## Browser (live backend, `VITE_USE_API_TASKS` on)

| # | Scenario | Result |
|---|---|---|
| 1 | Empty form: blocked with the message, nothing created | PASS |
| 2 | API-mode form: assigned date is "Today (set by the server)", upload box replaced by a note, real users loaded from the server | PASS |
| 3 | Two people selected: one task each (TASK-0001, TASK-0002) | PASS |
| 4 | Partial failure (server refused one person): created/failed list with reason and "Retry failed (1)" | PASS |
| 5 | Lost response (server created the task, browser saw a network error), then retry: same `clientRef` reused, still exactly 2 tasks, the teacher got one "New task" notification | PASS |
| 6 | Teacher sees only own tasks; Pending → In Progress with remark → Completed; remark stored; list refreshed without reload; no Update action after Completed; only forward options; Save disabled until the status changes | PASS |
| 7 | Server history shows assigned + status events with actor (principal / teacher) and remarks | PASS (API read) |
| 8 | Principal bell went 4 → 5 with "Task completed"; Principal list shows Completed and the remark on a cold load | PASS |
| 9 | Overdue label on backdated tasks (Teacher and Principal), none on due-today or completed tasks | PASS |
| 10 | Teacher opening the Assign Task page is redirected to My Tasks | PASS |
| 11 | Director role list is Principal + Front Office (PRM); Admin role list is Director only; Principal sees Coordinator / Teacher / Librarian | PASS |
| 12 | Director → Principal task: shown in Principal's My Tasks, bell 8 → 9, Director's list shows it | PASS |
| 13 | Admin → Director task created through the UI (TASK-0007); shown in Admin's list and in the Director's My Tasks (bell 2) | PASS |
| 14 | Principal → Teacher task created through the UI after the backend hierarchy change (TASK-0006) | PASS |
| 15 | Hierarchy bypass: the Principal's page was made to send a Director as the assignee; the server answered 403 and the screen showed "0 task(s) created, 1 could not be assigned … A principal cannot assign tasks to a director."; no task was created (list stayed at 5) | PASS |
| 16 | Flag off (local mode): two date pickers, upload box and demo teachers back; Principal assigned a task (PRI-TASK-001) and saw it listed without a Remarks column; Teacher saw it, moved it to In Progress with no remarks box; no API tasks mixed in (network traffic was not inspected) | PASS |
| 17 | Flag turned back on: server-set assigned date shown again | PASS |
| 18 | Self-assignment through the screen | NOT RUN (the assignee list never contains the caller; covered by the API probe and pytest) |
| 19 | Director / Admin "all tasks" view | NOT RUN (no such screen exists; Admin's list shows only tasks the Admin assigned, 1 entry) |
| 20 | Librarian, Front Office (PRM), Gatekeeper and Gatekeeper Manager screens | NOT RUN (no seeded users for those roles; hierarchy covered by the role map in code and the Principal / Director / Admin screens) |
| 21 | Super Admin screens, mobile layout, Export button, date filters | NOT RUN |

## API probes (live backend, after the restart with the hierarchy)

| Probe | Result |
|---|---|
| Principal → Director 403, Director → Teacher 403, Admin → Teacher 403, Teacher → Principal 403; none created a task | PASS |
| Principal → self 400 | PASS |
| `GET /tasks/assignees`: Principal 200 (coordinator, teacher), Director 200 (principal), Admin 200 (director); Principal `?role=director` 403; Teacher 403 | PASS |
| Earlier: past due date 400, blank title 400, bad priority 400, unknown assignee 400, assigner moving status 403, reopen 409, `box=all` 200 for Admin and 403 for Director / Teacher | PASS |
| 8 parallel list reads sent exactly one overdue notification per person (after the race fix) | PASS |

## Defects found and fixed in this work

- **Duplicate "Task overdue" notifications** (two per person) when two list reads ran at the same moment. The overdue flag is now claimed with one atomic update; regression test added.
- **Modal and list refresh**: the Update Status modal no longer uses an effect to copy props (it is re-created per task), and the lists keep their rows in state (React Compiler is on).

## Observed, not fixed

- The 4 pre-existing lint errors above.
- "Retry failed" is also shown after a permanent refusal such as 403 (it fails again, creates nothing).
- Escalation auto-climb could send duplicate notifications under the same kind of race as the task overdue alert (not touched).
- Clicking a notification marks it read but does not open the item.
- Client-side validation still uses a browser `alert` (existing pattern).

## Side effects on the dev database

- User `teacher2@qmis.edu` (EMP-0016) created through the HR API to test several assignees.
- Tasks TASK-0001 … TASK-0007 created during testing; the due dates of TASK-0003 and TASK-0004 were moved back one day directly in the database to test the overdue label.
- Duplicate overdue notifications created before the race fix remain.
- Local-mode test task in the browser storage was removed.

## Commands

```
cd backend
python -m pytest tests/ -q
```

## Coverage notes

- `tests/test_escalations_tasks.py` (19 tests) — escalations: rejection needs a note, auto-escalation notifications, Director/Admin access, one-level-up routing, receiver-only status, 24h clock, HR has no path, admin-only sweep; tasks: assign flow, validation, overdue once and race-safe, remarks and history, idempotent create, assignment hierarchy and assignee lookup limits
- `tests/test_leave.py` — chain principal→HR, on-leave lookup, permission rules, overlap 409, access rules, logout audited
- `tests/test_exams.py` — exam types, marks flow, publish after chain, ranks, parent sees own child only, weightage rules
- `tests/test_lesson_plans.py` — deadline rule, submit/lock, approval and visibility, revise to v2, reminders
- `tests/test_approvals.py` — 3-level chain, wrong role / self-decision 403, deny needs reason, notifications
- `tests/test_students.py`, `tests/test_attendance.py`, admissions, parents/children, finance, HR, Phase 0
- Pytest is not a browser Pass for Student Database / Class Attendance screens

## Seeded API logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@qmis.edu | admin123 |
| Teacher | teacher@qmis.edu | teacher123 |
| Coordinator | coordinator@qmis.edu | coord123 |
| Principal | principal@qmis.edu | principal123 |
| Director | director@qmis.edu | director123 |
| HR | hr@qmis.edu | hr12345 |
