# Testing report

Project: Queen Mira International School ERP  
Last run: 16 October 2026 — **Account Head complete functional audit**

## Suite / build

| Check | Result |
|---|---|
| Backend `python -m pytest tests/ -q` | **426 passed**, **0 failed**, 1 warning (~245s) |
| Finance suites `test_finance.py` + `test_finance_actions.py` | **6 passed** |
| Frontend `npm run build` | **PASS** (~54s) |

## Account Head — auth / RBAC

| Check | Result | Evidence |
|---|---|---|
| Login `accounthead@qmis.edu` | **PASS** | `GET /auth/me` → role `accounthead` |
| Permissions | **PASS** | `finance.read`, `finance.collect`, `finance.write`, `finance.approve` |
| Teacher `GET /finance/state` | **PASS** | **403** forbidden |
| Teacher `POST /finance/actions/collect-payment` | **PASS** | **403** |
| Account Head `GET /admin/users` | **PASS** | **403** (no admin users access) |
| Account Head `GET /hr/attendance` | **PASS** | **403** (no HR attendance access) |

## Finance hydrate / persistence

| Check | Result | Evidence |
|---|---|---|
| Initial `GET /finance/state` | **PASS** | 200; collections present (`students`, `installments`, `receipts`, …) |
| Refresh `GET /finance/state` | **PASS** | 200 again (same campus snapshot) |
| Campus snapshot contents | **PARTIAL** | **17 students**, **0 installments**, **0 receipts**, **0 approvals**, **0 transactions** (empty fee ledger) |
| Temp collect-payment | **PASS** | Seeded temp student/installment → collect ₹100 → receipt `RCP-FT-…` persisted on subsequent GET; invalid student → **404**; temp rows cleaned via PUT state |
| Decide-approval | **NOT TESTED** (no pending) | Campus approvals list empty |

## Dashboard KPI verification

| KPI | Source used | Verified vs snapshot | Status |
|---|---|---|---|
| Today's Collection | `dashboardMetrics.todaysCollection` (posted FEES inflow today) | Snapshot transactions 0 → **₹0** | **PASS** (after fix) |
| Today's Expenses | `dashboardMetrics.todaysExpenses` (posted OUT today) | **₹0** | **PASS** (after fix) |
| Pending Requests | pending approvals count | **0** | **PASS** (after fix) |
| Refund Requests | approvals type contains `refund` | **0** | **PASS** (after fix) |
| Current Fee Due | unpaid/partial installment balances | **₹0** (0 installments) | **PASS** |
| Charts (pie / income-expense / approval gauge) | Still static `dashboardData` series | Illustrative only — labeled in UI | **PARTIAL** |
| Recent collections table | Live receipts only in API mode | Empty (0 receipts) — no mock seed rows mixed | **PASS** (after fix) |
| Refresh button | Calls `reloadFinanceFromApi` | Wired | **PASS** (after fix) |

**Defect fixed (demo-blocking):** Dashboard previously displayed `seed ₹2,45,000 + live` for Today's Collection and left other KPIs on static seed. Now KPIs use finance snapshot metrics only (browser: no `2,45,000`; shows `LIVE` / `₹0`).

## Module-by-module (Account Head sidebar)

| Module | Status | Notes / evidence |
|---|---|---|
| Dashboard | **PASS** (KPIs) / **PARTIAL** (charts) | Live KPIs verified; chart series still demo |
| Fees Management | **PARTIAL** | UI loads (tabs present). Students available from finance state (17). Fee structures/installments empty — collect path API-proven with temp data; full UI collect round-trip on empty ledger not re-run in browser |
| Collections | **PARTIAL** | Driven by FinanceContext transactions/receipts; empty campus → empty/overview chrome. Browser load not fully exercised this pass |
| Wallet Management | **PARTIAL** | Wallets seeded from `walletManagementData` when offline; API empty campus uses finance wallets collection — mostly demo UI |
| Transport Finance | **PARTIAL** | Uses `transportFinanceData` seed tables + finance hooks for some actions — largely demo |
| Accounting (Day/Online/GL/Cash/Bank/COA/JV/Recon/Statements) | **PARTIAL** | Books hydrate from finance snapshot entries; empty → empty books. COA/JV still mix `accountingData` masters |
| Approvals | **PARTIAL** | Page loads (Pending tab present). Live decide API exists; campus had 0 pending — decide not browser-tested this pass |
| Reports & Analytics | **PARTIAL** | Static `reportsAnalyticsData` tiles/charts — demo |
| Task Management | **PASS** (shared) | Shared Common tasks routes (not re-audited deeply) |
| Settings | **PASS** / **PARTIAL** | Finance API SoT status panel exists (General). Roles/POS mostly local |
| Payment Vouchers | **PARTIAL** | Uses finance transactions; empty campus |
| Book Fee | **PARTIAL** | `DemoScreens.BookFeePage` — local/demo domain rows |
| Annual Budget | **PARTIAL** | Uses `annualBudget` from finance snapshot + editable inputs (persist via finance push when API on) |
| MFP Report | **NOT TESTED** / placeholder | `MfpPlaceholder` — “Template configuration pending” |

## Defects

| ID | Severity | Defect | Repro | Status |
|---|---|---|---|---|
| AH-KPI-1 | Demo-blocking | Dashboard KPI cards mixed static seed (e.g. ₹2,45,000) with live metrics | Login Account Head → Dashboard → Today's Collection showed inflated seed | **FIXED** |
| AH-FEE-1 | Data gap | Campus finance snapshot has students but no fee installments/receipts | `GET /finance/state` counts | **OPEN** (data, not code) |
| AH-CHART-1 | Demo | Income/expense pie & approval gauge still static | Dashboard charts | **OPEN** (labeled illustrative) |
| AH-MOD-1 | Demo | Wallet / Transport / Reports / Book Fee / MFP largely mock or placeholder | Sidebar navigation | **OPEN** |

## Changed files (this audit)

- `src/Pages/AccountHead/Dashboard/Dashboard.jsx` — live-only KPIs, live receipts table, refresh → API reload, status copy
- `src/Pages/AccountHead/financeDomain/FinanceContext.jsx` — `todaysExpenses`, `pendingApprovals`, `refundRequests` on `dashboardMetrics`
- `reports/testing-report.md`, `reports/daily-work-report.md`
