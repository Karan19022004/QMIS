# Testing report

Latest regression for Full Regression Triage / Release Readiness (12 November 2026).

## Full suite

```bash
cd backend
python -m pytest tests/ -q --tb=line
```

**Result:** **820 passed**, 35 skipped, **0 failed**, **0 errors**  
Artifact: `docs/_audit_extracts/_full_pytest_final.txt`

### Before (triage reproduce)

**790 passed**, 35 skipped, **22 failed**, **8 errors**  
Artifact: `docs/_audit_extracts/_full_pytest_triage_out.txt`

## Focused regression (ops / enrol / TC / academics / finance)

```bash
cd backend
python -m pytest tests/test_enroll_fee_gate.py tests/test_admissions.py tests/test_tc_noc_workflow.py tests/test_maintenance_housekeeping_isolation.py tests/test_stationery_gate_workflows.py tests/test_academics_collections.py::test_teacher_allocation_syncs_section_class_teacher tests/test_finance_actions.py::test_gateway_intent_and_approval -q
```

**Result:** **45 passed**

Covers:
- Enrol fee gate (receipt / Waived / Paid-token blocked)
- TC Manager NOC workflow
- HK/Maint isolation
- Stationery GRN / issue-return / request decide
- Teacher allocation sync (isolation fixture)
- Payment gateway stub intent path

## Browser / API UAT

- `docs/_audit_extracts/_deeper_ops_browser_uat_results.json` — **8/8 API**, **28/28 flows**
- Prior smoke: `_final_ops_browser_uat_results.json`

## Frontend

```bash
npm run build
```

**Result:** **PASS** (chunk-size warnings only)
