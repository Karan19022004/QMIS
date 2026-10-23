# QMIS ERP — Production Readiness Report

**Date:** 23 October 2026  
**Branch:** `ERP1` @ `513fada` (+ local uncommitted readiness fixes)  
**Scope:** Confirmed blockers only. Payment gateway, live tracking enablement, and unapproved roles were not changed.

## 1. Root causes addressed

### 1.1 Canteen orders (P0)

**Root cause:** `AddOrder.jsx` opened the “Order Saved” modal on Save click without calling `saveOrders` / `/api/v1/ops/canteen-orders`.

**Change:**
- Lifted order draft state into `AddOrder`.
- Save hydrates campus orders + menu, builds a record, `await saveOrders(...)`, and only then opens the success modal.
- API errors and validation show toasts; button shows “Saving…”.
- Regression: `test_canteen_orders_persist_after_new_login` + static FE guard.

### 1.2 ProTrack365 device selection (P0)

**Root cause:** `useProtrackLive.js` used `devicesList[0]` when IMEI/plate did not match. Student Track Bus also used `live.devices[0]`. Map UI showed a green **LIVE** badge over demo coordinates.

**Change:**
- Removed silent first-device fallback; require explicit IMEI or plate match.
- Student/parent Track Bus loads preferred IMEI/plate from `/ops/my-transport` assignment (no first-row device pick).
- Transport Manager Track Bus no longer presents demo stats as live ETA/speed.
- `BusTrackingMap` uses `trackingMode`: demo shows **DEMO ROUTE — NOT LIVE GPS**; live badge only with a real fix.
- Live tracking remains off until credentials + mapping + current fix exist.

### 1.3 Environment configuration

**Documented in** `backend/.env.example` (placeholders only):

| Variable group | Purpose | Live when empty |
|---|---|---|
| `SMTP_*` | Email delivery | `NOT_CONFIGURED` — no real send |
| `WHATSAPP_*` | WhatsApp HTTP API | `NOT_CONFIGURED` — no real send |
| `PROTRACK_*` | ProTrack365 Open API | Proxy returns not configured / tracking off |

No credentials were read, printed, committed, or used for provider calls in this pass.

## 2. Remaining browser workflows (from system audit)

Not re-walked in the browser in this fix pass. Status unchanged unless noted:

| Area | Status |
|---|---|
| Parent/student fees | Prior PARTIAL browser evidence |
| Librarian issue/return re-walk | NOT TESTED this pass |
| TM expenses / student-transport click | NOT TESTED |
| Stores issue/return click | NOT TESTED |
| IT tickets | NOT TESTED |
| HK / audit re-login | NOT TESTED |
| Canteen **order** save UI | **Browser verified 23 Oct 2026** (see §6) |
| Super Admin / Admin / Director / Principal full panels | NOT TESTED |
| Live GPS end-to-end | BLOCKED (no credentials / no verified IMEI) |

## 3. Test evidence

Executed 23 October 2026 after the fixes:

| Check | Result |
|---|---|
| Targeted pytest (`test_remaining_workflows`, static readiness, `test_protrack_proxy`) | **8 passed** |
| Full `python -m pytest tests/ -q` | **464 passed**, 0 failed (~4m 41s) |
| `npm run build` | **passed** (~1m 7s) |

No tests were weakened or deleted.

## 4. Remaining deployment blockers

1. **SMTP / WhatsApp** not configured — notifications not LIVE_VERIFIED.  
2. **ProTrack** accounts empty; no confirmed IMEI for production plates (e.g. TN58BB3769).  
3. ~~Browser verification of canteen order save~~ — completed for the happy path + controlled fail-save (see §6). Full product production readiness still blocked by items 1–2 and other PARTIAL modules.  
4. Other PARTIAL modules from the system audit remain.  
5. Payment gateway still mocked (intentionally unchanged).  
6. Do **not** claim full production readiness until SMTP/WhatsApp/ProTrack and remaining PARTIAL modules are verified.

## 5. Explicit non-changes

- Payment processing / Razorpay behaviour unchanged.  
- Live bus tracking not enabled.  
- No new roles.  
- No commit / push / deploy in this browser-verification pass.

## 6. Browser verification — canteen order persist (23 Oct 2026)

**Environment:** `http://localhost:5173` + local backend; branch `ERP1` @ `513fada` with uncommitted readiness fixes preserved (no commit/push/deploy).  
**Account:** `canteen.browser.oct23b@example.com` (authorized Canteen).  
**Menu item used:** `Browser lemon rice` (₹50).  
**Unique order marker:** special instructions `BrowserOrder-Oct23-2210-unique` → order id `ORD-73604359`.

| Step | Result | Evidence |
|---|---|---|
| Sign in as Canteen; create uniquely named order | **PASS** | Form saved; UI showed “Saving…” then **Order Saved** modal only after save |
| Backend persisted order | **PASS** | `GET /api/v1/ops/canteen-orders` returned `ORD-73604359` / `BrowserOrder-Oct23-2210-unique` |
| Success UI only after save | **PASS** | Success modal gated on `await saveOrders(...)` (observed Saving… → Order Saved) |
| Refresh list — order remains, no duplicate | **PASS** | Orders list `Showing 1 to 1 of 1 entries`; `ORD-73604359` count = 1 |
| Sign out → sign in → order remains | **PASS** | After re-login to `/canteen-manager/orders`, same single row `ORD-73604359` |
| Controlled failed save (browser `fetch` write-block on `canteen-orders` non-GET) | **PASS** | Toast: “The order could not be saved. Check your connection and try again.”; **no** Order Saved modal; API still only `ORD-73604359` (failed attempt `FailSave-Oct23-2213-unique` not persisted) |
| Duplicate from refresh / re-render | **PASS** | Still one entry after refresh and re-login |

### Untested / out of scope this pass

- Payment gateway / Razorpay  
- Live ProTrack GPS  
- Other canteen submodules (inventory, requests, announcements) beyond order create/list  
- Other roles/modules from the system audit  

### Failures

None observed for the canteen order persist workflow above. No additional code fix was required after the browser walk.
