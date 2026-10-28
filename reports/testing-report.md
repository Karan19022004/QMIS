# Testing report

**Date:** 28 October 2026 (merge onto `qmis/main` + push prep)  
**Branch:** `main` (tracks `qmis/main`)  
**Context:** Academic phases + frontend approval screens merged without overriding main Result Details / Exam Schedule / biometric

## Frontend build

`npm run build` — **success** (~57s)

## Focused pytest (merge verification)

Command: `.venv\Scripts\python.exe -m pytest` on academic + static suites from `backend/`.

| Metric | Count |
|---|---|
| Passed | **82** (after aligning 3 static assertions with main biometric / coordinator paths / ResultDetails API) |
| Failed | **0** |
| Notes | Kept main `ResultDetails` (`getStudentResultsApi`) and `ExamSchedule` (`loadMergedExamRecords`); helpers in `Common/Results/*` remain for unit coverage |

### Suites included

`test_mark_entry_phase1`, `test_approval_screens_phase2`, `test_results_phase3`, `test_results_after_promotion`, `test_promotion_guard_phase5`, `test_marks_correction_phase6`, `test_result_notifications_phase7`, `test_announcements_ops_audience`, `test_it_tickets_self_service`, `test_frontend_fixes_static`

## Browser (isolated ports 8001 / 5181)

- Parent `e2e.parent.meera@example.com`: Exam Result shows **E2E Midterm G7 · Maths 46/50 · 92%** while current class is **Grade 8** (post-promotion history)
- Notifications: **2 × “Result published”** (initial publish + approved correction), Meera only
- Parent dashboard wired to API summary (was demo zeros)

## Notes

- Phase 5 uses existing `academics_records` uniqueness — **no migration**
- Phase 6 correction chain is Principal → Director (`marks_correction`)
- Restored `raiseTicket` / `listMyTickets` exports (frontend crash)
- Rewrote corrupted `LessonPlanGroupDetail.jsx` (dead `director-approval` / broken JSX)
