# QMIS Staff Reconciliation Report (redacted)

**Generated:** 2026-10-28T06:35:17.215699+00:00
**Mode:** Compare Excel ↔ hrSeed ↔ isolated provision DB only. **No live database writes.**

## Summary

| Metric | Count |
|---|---:|
| Excel body rows under first header (often read as “122”) | 122 |
| — blank rows in body | 1 |
| — repeated column-header rows in body | 1 |
| Real staff rows parsed | 120 |
| After email dedupe | 120 |
| hrSeed EMP-QMIS-* records | 120 |
| Cells with multiple emails (primary used) | 7 |
| Eligible for login (role + valid email) — Excel view | 100 |
| Directory-only (no RBAC role) — Excel view | 20 |
| Eligible in hrSeed | 100 |
| Directory-only / ineligible in hrSeed | 20 |
| Isolated DB EMP-QMIS employee rows | 100 |
| Isolated DB EMP-QMIS with linked user | 100 |
| Isolated: eligible with account | 100 |
| Isolated: eligible missing account | 0 |
| Duplicate email groups in Excel | 0 |
| Invalid email blocking eligible login | 0 |
| Dry-run would create on **current** isolated DB | 0 |

### Why 122 vs 120

The sheet has **122** rows under the first header. That includes **1** blank row(s) and **1** repeated header row(s). **120** are real staff — matching hrSeed.

## Live campus

Isolated-test credentials are NOT valid on live. Live account counts were not queried.

Do **not** assume the 100 isolated-test credentials work on live. Live provisioning requires explicit approval after this report is reviewed.

## Duplicate emails in Excel (kept first occurrence)

_None._

## Invalid or malformed emails

_None blocking eligible login in hrSeed._

## Excel rows not matched into hrSeed (unexpected)

_None — deduped Excel aligns with hrSeed import path._

## Name-only matches (verify before any account action)

_None._

## hrSeed rows missing from Excel (unexpected)

_None._

## Eligible missing account in isolated DB

_None — all hrSeed-eligible staff have a linked user in the isolated DB._

## Review notes

- EMP-QMIS-117 / C Sivasankari: directory-only and email invalid ((invalid-or-missing))
- Isolated DB already has 100 EMP-QMIS-* rows linked to users; 0 eligible still missing there.
- Local handoff file exists with count=100 (passwords not read into this report). Valid only for the isolated SQLite used when it was generated — not live.
- Excel raw staff rows=120; after email dedupe=120; hrSeed=120. Gap of 0 is duplicate-email rows skipped at import.

## Recommended next steps (no action taken)

1. Review duplicate Excel rows and decide which person keeps the shared email.
2. Fix invalid emails / assign RBAC roles for directory-only staff who need portal access.
3. After approval only: run live provisioning with backup + `--i-understand-live`, writing credentials solely for **newly created** accounts.
4. Do not redistribute the isolated handoff file for live use.

