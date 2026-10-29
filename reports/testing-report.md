# Testing report

**Date:** 29 October 2026  
**Context:** User Creation crash-fix verification (`getAdminAccessLabel`). Local Vite `:5173` → API `:8000`. No production writes. Not committed/pushed.

## Latest — Crash-fix verification

| Suite / check | Result |
|---|---|
| `pytest tests/test_admin_users.py tests/test_admin_employee_directory.py tests/test_frontend_admin_users_static.py tests/test_frontend_superadmin_approvals_static.py -q --import-mode=importlib` | **69 passed** |
| `pytest tests/test_frontend_admin_users_static.py` (incl. export label guard) | **12 passed** |
| `npm run build` | **PASS** (`BUILD_EXIT=0`) |
| Browser list + Export modal (no `getPermissionCount` crash) | **PASS** |
| Browser create `uat.crashfix.admin@qmis.edu` → list/view labels | **PASS** |
| Admin cannot create/manage admin; teacher PATCH 403 | **PASS** (API) |
| ASA-04 `ACT-CUL-006` still Approved | **PASS** (API smoke) |

## Prior same day — Browser UAT ASA-02 / ASA-04

| Suite / check | Result |
|---|---|
| ASA-02 deactivate / reactivate / failure handling | **PASS** (browser; audit §14) |
| ASA-04 activity approve + demo quarantine | **PASS** (browser; audit §14) |
| Isolated `:5181`→`:8001` login | **BLOCKED** (CORS) |

## Coverage notes

- Crash path: Export/list no longer calls unbound `getPermissionCount`.
- Unused exports of `getPermissionCount` remain in `adminUsersData.js` / `rolePermissionsData.js` (not broken call sites).
- Disposable admins `uat.asa02.admin@qmis.edu` and `uat.crashfix.admin@qmis.edu` left Active.

## Not run / blockers

- Full browser re-run of ASA-02/ASA-04 decide flows (already §14).
- Product confirmation for non-activity approval domains (§10 Q5).
- ASA-05+.
