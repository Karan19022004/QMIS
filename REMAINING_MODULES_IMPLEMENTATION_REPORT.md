# Remaining modules implementation report

Date: 23 October 2026  
Branch: `ERP1`  
Method: Inspect existing portals and APIs, then connect the verified gaps. No credentials were hardcoded. Hostel Warden was not created. Admissions stay on PRM.

## Summary

| Module | Status | Why |
|---|---|---|
| Parent portal | PARTIAL | Browser checkout passed for one tuition installment, including refresh and a new login. Issue/return, transport GPS, and the rest of the parent menu were not walked. |
| Student portal | PARTIAL | After the parent payment, the student signed in and saw the same paid installment and zero outstanding. The student did not start a second payment. |
| Librarian | PARTIAL | A new sign-in still showed "Browser Atlas" among 4 catalogue rows. Issue and return were not repeated in this pass. |
| Transport Manager | PARTIAL | A new sign-in still showed vehicle TN01BRW2222, route Browser West Route, and the duty for TN01BRW1111. Dropdowns now list those saved records. An oil-change maintenance row survived refresh. Expenses and student-transport save were not clicked. Live tracking was not opened. |
| Transport Driver | PARTIAL | The server returns only the assigned vehicle. Browser Vehicle Details showed TN01BRW1111. My Duty now opens the saved list and no longer crashes on the sample constant. No duty was assigned, so the list was empty. A second sign-in after that check was not repeated. |
| Gate | PARTIAL | After the local API was reloaded, the gate-pass page listed 5 saved passes, including student pass DEMO-FO-SGP-001 for Aarav Mehta. Gate staff remain read-only. Visitor "Browser Guest Oct23" was confirmed on an earlier new sign-in. |
| Stores | PARTIAL | A new sign-in opened `/stationery-store-manager/inventory` directly and still showed "Browser graphite pencil". The issue/return form now saves, but that screen was not clicked. |
| Canteen | PARTIAL | A new sign-in still showed "Browser lemon rice". Orders still open a success window without saving a record. |
| IT | PARTIAL | A new sign-in still showed "Browser lab projector". Opening the stationery address while signed in as IT returns to the IT dashboard; that is the role guard. The stationery user is not redirected. Tickets were not created. |
| Housekeeping | PARTIAL | Browser: signed in, added schedule "Browser corridor sweep" (DAILY, Active). After refresh the list still had 4 records, including that schedule. A second sign-in after the save was not repeated. |
| Joint Director / Process / Quality audit | PARTIAL | Audit assignment save/reload is tested for the audit role. Process observations persist. Assign screens now save. Browser not repeated. |

Nothing in this list is marked COMPLETE. A dashboard that loads is not treated as done.

## What changed in this pass

### Parent and student fees

Original gap: fee screens read the in-memory finance book. Parents and students were excluded from the finance load, and the scoped fee API was never called. A parent who only has fee-view permission could still request the full campus ledger because that permission was accepted on the campus finance read.

Implemented:

- Family sign-in loads only linked children (parent) or the logged-in student.
- Pay uses the family payment action (UPI or card). Cash and cheque stay at the finance desk.
- The family session does not write the campus finance snapshot.
- Campus finance read now requires finance write or collect, so a parent or student cannot download the whole ledger.
- Bus route details load only that family's transport assignment.

Verified by automated test `test_parent_fees_are_scoped_and_full_ledger_is_denied`: parent ledger is one student, full ledger is forbidden, empty transport assignment returns successfully, teacher is forbidden from both family endpoints.

### What was already connected (not rebuilt)

Librarian, Transport Manager, Driver (except the limits above), Gate, Stores, Canteen, IT, Housekeeping, and auditor fieldwork already persist through campus operations or campus-audit collections when API sign-in is on. Replacing those screens again would risk working behaviour. They stay PARTIAL until each role is signed in and the main save/refresh/re-login path is exercised.

## Role and permission checks

- Shared login is unchanged.
- Parent and student fee data is filtered on the server to linked records.
- Teacher cannot call the family fee or family transport endpoints (test).
- Finance Assistant remains collect-only; that was not loosened.
- Drivers still share the login. They do not have a separate site. The server limits a driver to the assigned vehicle, route, and duty. Transport Manager cannot create the driver login; HR staff creation does.
- Hostel Warden was not added.

## Follow-up on 23 October 2026 (workflow gaps)

### Parent payment checkout

The checkout window no longer shows success before the ledger answers. It stays in a waiting state, can be cancelled before the request finishes, and shows the server error if the ledger does not return a receipt or transaction. A random mock decline was removed from this path.

Verified by `test_parent_payment_is_confirmed_by_the_ledger`: a parent payment marks the installment paid and a second read of the family ledger still shows that paid amount. The browser click-through was not run, so the portal stays PARTIAL.

### Driver access

A driver login is created through HR staff creation, not by the Transport Manager. The server keeps other drivers' vehicles when a driver saves, and rejects a write for a vehicle that is not assigned. The test also checks that the other vehicle is still present for an administrator.

### Audit assignments

Assign, history, workload, and reassign screens read and save the campus audit-assignment collection (title, owner, due date, status, evidence). `test_department_roles_persist_their_own_records` creates an audit user through HR and confirms the assignment survives a new login.

### Vehicle health

Sample rows are not uploaded when the API is on. New health records save to `transport-vehicle-health`. The driver test saves a health row for the assigned vehicle and reads it back.

### Role checks (API, new login)

HR created each account. Each role saved one record, signed in again, and still saw it. A teacher could not write those collections.

| Role | Record checked |
|---|---|
| Librarian | library book |
| Gate keeper | visitor |
| Canteen manager | menu item |
| IT support manager | asset |
| Stationery store manager | stock line |
| Housekeeping manager | schedule |
| Process auditor | observation |
| Joint Director audit | audit assignment |
| Driver | assigned vehicle only, plus vehicle health |

## Browser verification — 23 October 2026

Accounts for the other roles were created through the HR staff API so the browser could sign in. Parent and student accounts came from enrollment. No real payment and no real message was sent. No module is marked COMPLETE.

| Workflow | Browser result | Evidence |
|---|---|---|
| Parent login and linked child | Passed | Sign-in opened the parent dashboard. Header showed Current Child: Browser Child. |
| Parent fee checkout | Passed | Academic Payment showed Total Fee ₹500 and Outstanding ₹500. Selecting "Browser term Tuition" enabled Pay Now at ₹500. UPI checkout showed "Waiting for the school ledger to confirm…". After the server answered, Paid became ₹500, Outstanding ₹0, and receipt REC-0003 opened. The installment said "Settled — not included in Pay Now". |
| Parent refresh | Passed | Reloading the fee page still showed balance ₹0 and Settled. |
| Parent new login | Passed | Sign out, sign in again, open Academic Payment: Paid ₹500, Outstanding ₹0, Settled. |
| Student login and same fee | Passed | Student sign-in landed on the student class page. Academic Payment showed Paid ₹500 and Outstanding ₹0. A second payment was not started because the installment was already settled. |
| Librarian book create, issue, return | Create, issue, and return were done earlier; a new sign-in now shows the book | A fresh librarian sign-in opened the book list and showed "Browser Atlas" with Total Records: 4. Issue and return were not repeated in this pass. |
| Transport Manager vehicle, route, duty | Passed create and refresh; maintenance, expenses, and a new login were not clicked | Saved vehicle TN01BRW2222, route "Browser West Route", and a morning duty for TN01BRW1111. Each list still showed the new row after refresh. The first vehicle save replaced earlier vehicle rows because the form read an empty cache; later saves load the current list first. Driver and route dropdowns still offer the old sample names. Live tracking was not opened. |
| Driver assigned vehicle and health | Passed the corrected screens; duty list opens empty; re-login not repeated | Vehicle Details showed TN01BRW1111, Van, Browser Driver, Browser Route. A health row for that vehicle survived reload. My Duty was a blank page because it filtered a missing constant. It now lists saved duties. With no assigned duty, it showed "Showing 1 to 0 of 0 entries" and did not show the sample plate TN 33 AB 1234. A second sign-in was not repeated. Left PARTIAL. |
| Gate visitor and gate passes | Visitor survived a new sign-in; gate-pass list no longer uses the sample row | Signed in again. Visitors still listed "Browser Guest Oct23", Total Records: 2. The gate-pass page previously showed fixed sample pass GP001 / Ravi Kumar and claimed 20 entries. It now asks the campus API. On the already-running API the gate user received 403, so the page said the passes could not be loaded and showed 0 rows. |
| Stores / stationery stock | Passed create and refresh; issue/return and a new login were not repeated | Signed in. Saved "Browser graphite pencil", category Pen. After reload the inventory showed that item, 1 of 1 entries. |
| Canteen menu | Passed validation, create, and refresh; orders and a new login were not repeated | Saving with a blank name showed "Item name is required" and stayed on the form. Saved "Browser lemon rice", category Lunch. After reload the menu showed that item, 1 of 1 entries. |
| IT asset or ticket | Passed asset create and refresh; tickets were not created | Saved "Browser lab projector", category Projector. After reload the asset list showed that name, 1 of 1 entries. The dashboard still says its ticket counts come from a store in this browser. Opening the stationery inventory address returned this user to the IT dashboard. |
| Housekeeping schedule | Passed create and refresh; re-login after the save not repeated | Signed in. Recurring schedules already had 3 records. Added "Browser corridor sweep", DAILY, Active. Total became 4. Search showed that one row. After reload, Total Records was 4 and the same name was still listed. Left PARTIAL. |
| Audit assign, status, evidence | Passed create and refresh; re-login not repeated | Signed in as the audit user. Saved "Browser term audit", owner Process team, due 2026-11-15, evidence "Checklist attached in campus file", status Assigned. After reload the same assignment was still on the page. A second sign-in was not repeated. Left PARTIAL. |
| Live bus tracking | BLOCKED | Needs the school tracking service. Not attempted. |

## Defect fixes

Librarian Add Book pointed at a route the app did not render, so the screen fell through to "Librarian Dashboard", and the form did not save. The form now saves a catalogue row. Issue and return update availability. API mode no longer uploads the sample catalogue when a collection is empty.

Driver Vehicle Details no longer uses the fixed sample card. It loads the signed-in driver's assignment. Vehicle health no longer lists the sample plates when the API is on.

## Notifications — 23 October 2026

Email and WhatsApp delivery code was already present. It returns `NOT_CONFIGURED` when SMTP or the WhatsApp provider is empty, and it does not claim the message was delivered. This pass connects that code to saved business events. It does not turn live sending on.

| Channel | Status | Evidence |
|---|---|---|
| Email | IMPLEMENTED, MOCK_TESTED, NOT_CONFIGURED | Hooks run after the record is saved. Automated tests show `NOT_CONFIGURED` and `delivered: false` when SMTP is empty. A queued notice is not sent a second time for the same event key. |
| WhatsApp | IMPLEMENTED, NOT_CONFIGURED | The provider call already exists. No WhatsApp token is configured. A phone number is not treated as consent, so enrollment does not send WhatsApp. |
| Live delivery | Not LIVE_VERIFIED | No mailbox password and no provider token were added. No real message was sent. |

Events that now call the notifier after a successful save:

- Enrollment confirmation to the parent account email. The message does not include a password.
- Leave submission to the first approver role. The reason is not included.
- Leave decision to the staff member who filed it.
- Password reset notice to the staff email. The temporary password stays on the HR screen and is not copied into the message.
- Announcement title and category to the audience roles. The full text stays in the app.
- Gate, IT ticket, canteen order, stationery, housekeeping, transport duty, and transport assignment changes, to the role that owns that work, and only when the tracked status actually changes.
- Audit assignment to the assigned auditor role. Evidence is not included.
- Library issue or return only when the member record already has an email. A name alone is not enough, so those notices are skipped today.

`backend/.env.example` keeps SMTP host, port, username, password, and From empty, and keeps the WhatsApp URL and token empty. The app does not set a Reply-To address. The school must supply a new app password and a provider token outside Git. Payment processing and live bus tracking were not changed.

API mode no longer uploads sample catalogues into an empty campus collection. Records already stored, including older sample rows, are left in place.

## Browser verification — later on 23 October 2026

Save buttons on Transport Manager, Stores, and Canteen used to show success without writing a record. Those create forms now write the campus collection after loading the current rows. The IT asset form already saved. The gate-pass table no longer invents GP001.

Payment processing and live bus tracking were not changed. Email and WhatsApp were not reconfigured and no real message was sent.

## Follow-up on 23 October 2026 (gate 403, dropdowns, new logins)

### Gate pass 403

The source already allowed a gatekeeper to read collections whose names end in `gate-passes`, and refused writes and other front-office collections. The process on port 8000 had been started as `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` without auto-reload, so it was still running the older rule and returned 403.

That local API process was stopped and started again with the same command so it loaded the current source. After that, the gate account received HTTP 200 for student, hostel, and material passes (1, 1, and 3 records) and HTTP 403 for student transfers. In the browser the gate-pass page listed 5 saved passes, including student pass DEMO-FO-SGP-001, Aarav Mehta, Medical appointment. The sample row Ravi Kumar was not shown.

### Route and driver dropdowns

Add-route, assign-duty, student-transport, maintenance, and expense forms were built from the sample constants `VEHICLES`, `DRIVERS`, and `ROUTES`. They now load the campus collections after sign-in. On a new Transport Manager sign-in the vehicle list contained only TN01BRW2222, the driver list only Browser Driver, and the route list only Browser West Route. Sandy Selva and the TN-09 sample plates were not in those dropdowns.

The earlier vehicle save still left a single vehicle row. Those replaced rows were not restored.

### Stationery address

`App.jsx` sends a signed-in user back to that role's home when the address belongs to another role. An IT sign-in that opened `/stationery-store-manager/inventory` landed on the IT dashboard. A stationery sign-in that opened the same address stayed on the inventory page, with Stores in the sidebar, and still showed Browser graphite pencil.

### New sign-in checks

| Record | New sign-in |
|---|---|
| Vehicle TN01BRW2222 | Still listed, 1 of 1 |
| Route Browser West Route | Still listed, 1 of 1 |
| Duty for TN01BRW1111 | Still listed, 1 of 1 |
| Inventory Browser graphite pencil | Still listed |
| Menu Browser lemon rice | Still listed |
| Asset Browser lab projector | Still listed |
| Maintenance oil change for TN01BRW2222 | Saved and still listed after refresh. A second sign-in was not repeated for this row. |

## Remaining issues

1. Canteen orders still show success without saving. Stock issue/return now has a save action, but that screen was not clicked. IT tickets, expenses, and student-transport save were not clicked.
2. Audit, parent, student, driver duty, and housekeeping were not opened again in this pass.
3. The vehicle collection still has only TN01BRW2222. Earlier rows were not restored.
4. Email and WhatsApp stay NOT_CONFIGURED and are not LIVE_VERIFIED.
5. Track Bus stays BLOCKED. Nothing is marked COMPLETE. Not production-ready. Not pushed.

## Test results

- Backend after the gate-pass reload and dropdown work: `python -m pytest tests/ -q` — **460 passed**, 0 failed (3 minutes 38 seconds).
- Frontend production build: `npm run build` — **passed** (about 51 seconds).
- Browser on `http://localhost:5173`: vehicle, route, duty, stationery item, canteen item, IT asset, librarian catalogue, and gate visitor checks above. No real email, WhatsApp message, or payment was sent.
