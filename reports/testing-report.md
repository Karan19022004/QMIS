# Testing report

**Date:** 28 October 2026  
**Branch:** local uncommitted work (not pushed)  
**Context:** Junior enroll validation + gateway `finance.pay` permission fixes. **No live campus DB writes.**

## Latest pytest (related suites)

| Suite | Result |
|---|---|
| Junior enroll + pending-hash regression (`test_admissions` junior cases) | **8 passed** |
| Parent `pay-my-fees` (`test_finance.py::test_parent_payment_is_confirmed_by_the_ledger`) | **passed** |
| Combined admissions junior + parent pay | **9 passed** |
| `test_finance_actions` gateway intent/confirm | **failed (env)** — `503 not_configured` (Razorpay / `INTEGRATIONS_MODE`); not a 403 permission failure |

Regression added: `test_junior_enroll_rejects_pending_student_hash_when_student_account_requested`.

## Earlier same-day — staff provision

| Check | Result |
|---|---|
| Live create-missing EMP-QMIS | **100** created; **78** prior preserved (gitignored handoff) |
| `tests/test_staff_login_provision.py` + reconciliation | **6 passed** (earlier) |

## Notes

- Portal payment now requires `finance.pay`; `finance.read` remains view-only (`GET /finance/my-fees`).
- Gateway stub failures under empty Razorpay keys are separate from the permission change.
