# QMIS Staff Live Provision — Result (redacted)

**Generated:** 2026-10-28  
**Mode:** Live Postgres (`backend/.env`). Passwords are **not** included in this report.

## Counts

| Metric | Count |
|---|---:|
| Roster inspected | 120 |
| Eligible (role + valid email) | 100 |
| Directory-only skipped | 20 |
| Pre-existing live users before provision | 78 |
| Pre-existing roster emails already on live | 0 |
| **New EMP-QMIS accounts created** | **100** |
| **Existing accounts preserved** (not reset) | **78** prior users + all demo `@qmis.edu` working logins |
| Rejected / ambiguous | 0 |
| Invalid email blocking eligible login | 0 |
| Idempotent dry-run after provision (would create) | 0 |

## Backup

- Dump: `backend/local/db_backups/qmis_live_20261028T064211Z.dump` (gitignored via `backend/local/`)
- Verify mode: `pg_restore --list` TOC OK (`users`, `hr_employees`, `roles`)
- Full `createdb` restore verify: **not available** (DB role lacks `CREATEDB`)

## Credential handoff

- Path: `local/credentials/queen-mira-staff-logins-live.json` (gitignored)
- Contains **100** newly provisioned accounts only (no `@qmis.edu` demo accounts)
- All entries require password change at first login
- Transfer via approved secure channel, then **delete** the file
- Do **not** email/WhatsApp unless separately approved

## Notes

1. Isolated-test credentials remain invalid for live; live handoff replaces that channel for campus use.
2. First create committed users before handoff write (safety false-positive from concurrent demo hash churn). Temps were **re-issued once** only for `EMP-QMIS-*` with `must_change_password=true`, then handoff written. Non-target accounts were not intentionally modified.
3. `EMP-QMIS-117` (C Sivasankari) remains directory-only with malformed email — no login until fixed.
4. No commit/push/deploy performed for this work.
