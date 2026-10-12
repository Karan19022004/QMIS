# Daily work report

Project: Queen Mira International School ERP  
Area: Phase 1 — Finance foundation  
Prepared for: Manager update  

New days go at the top. Older days stay below so the history is in one file.

---

## 12 October 2026

**Status:** Blank screen fixed; Postgres/pgAdmin password aligned; Admin admissions A1–A8 API path unblocked. Manual UI retest still needed from user.

### Done

1. **Blank screen** — `HRRoutes` eager `EMPLOYEES[0]` before HR hydrate; lazy redirect fix.
2. **Postgres** — PG18 on `:5432`; `backend/.env` password set to user’s `Karan@123` (`Karan%40123` in URL).
3. **Admissions 500s (why A1–A8 failed)**
   - List: legacy enquiry with null `enquiry_code` broke `EnquiryOut`
   - Create: Phase-0 `guardian_name` NOT NULL + null insert
   - Enroll: `ADM-0001` collided with existing student admission number
   - Fixes: schema migrate (nullable legacy cols + backfill codes), default guardian name, unique ADM code across admissions+students, enroll remaps colliding codes
4. **API verify** — create enquiry → convert → enroll returns 200; parent user can be created.

4. **Automation without school data** — pytest admissions + e2e; live smoke parent login.
5. **P1-4 Select Child** — implemented `GET /api/v1/parents/me/children`; ParentChildContext loads API children when API auth on; empty-state message on Select Child. Live smoke PASS.

### Still open

- User confirm Select Child shows child card in browser
- Phase 2 not started


---

## 10 October 2026 (Phase 1)

**Status:** Phase 1 Finance foundation implemented and tested. **45 pytest passed.** Persistence smoke **3/3** on `:8003`. Phase 2 not started.

### Done (Phase 1 only)

1. **Finance Head / Assistant permissions** (roles preserved)
   - `accounthead` = Finance Head: `finance.read` + `collect` + `write` + `approve`
   - `finance_assistant`: `finance.read` + `finance.collect` only (no config write / approve)
   - Seeded `finance.assistant@qmis.edu` / `finance123`
   - Routes wired: collect/send/settle/intent → collect|write; approve/confirm/concessions → approve|write; PUT state → write only

2. **Financial year (April–March)** separate from academic year
   - Table `financial_years` + `/masters/financial-years*` (list/create/get/current/patch/set-current)
   - Seed `FY 2026-27` (2026-04-01 → 2027-03-31)
   - Rejects non April–March ranges
   - Finance snapshot `meta` includes `financialYearId/Name/Start/End` + `financialYearStartMonth=April`

3. **Fee-structure validation (PostgreSQL SoT)**
   - On save: feeCategories / feeStructures / fineRules validated (ids, academicYear, class, non-negative amounts, no duplicate ids)
   - Snapshot still stored in `finance_records` (existing pattern — not a rewrite)

4. **Account Head persistence verification**
   - Pytest: save → new login → GET marker still present
   - Live smoke: `scripts/smoke_accounthead_persistence.py` → **3/3 PASS** (save, re-login, assistant PUT denied)
   - Full Chromium UI click-through: **NOT RUN** this session (no browser E2E harness); API path used as refresh/logout/login evidence

### Missing information (not assumed)

- Concession percentages and approval limits (school)
- Sibling/special concession rules
- Accounting / double-entry chart mapping
- Paytm vs Razorpay final approval (Razorpay left unchanged)
- Live SMTP / WhatsApp credentials
- RFID/eSSL requirement (remains disabled)

### Still open (Phase 2+)

- Core fee collection expansion, refunds, yearly increase
- Live Paytm/SMTP/WhatsApp when approved
- Ops verticals; browser E2E framework

### How to verify

- Head: `accounthead@qmis.edu` / `accounts123`
- Assistant: `finance.assistant@qmis.edu` / `finance123`
- `python -m pytest tests/ -q`
- `python scripts/smoke_accounthead_persistence.py http://127.0.0.1:8003`

---

## 10 October 2026 (earlier — demo integrations)

Demo Razorpay/SMTP/WhatsApp + HR↔Finance click-through; RFID off. See prior section in testing report history.
