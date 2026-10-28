# One-time staff credential handoffs

Files written here (for example `queen-mira-staff-logins-live.json` and `Queen_Mira_Staff_Login_Credentials.xlsx`) contain **temporary passwords** for newly provisioned Queen Mira staff accounts.

## Rules

1. Do **not** commit anything in this folder except this README.
2. Transfer the handoff file only through an approved secure channel (e.g. sealed print / secure share to HR).
3. Delete the handoff file immediately after distribution.
4. Never paste temporary passwords into tickets, chat, git, or ordinary reports.
5. Recipients must change password at first login (`must_change_password`).

Provisioning tool (isolated DB by default):

```text
backend/.venv/Scripts/python.exe backend/scripts/provision_queen_mira_staff_logins.py --dry-run
backend/.venv/Scripts/python.exe backend/scripts/provision_queen_mira_staff_logins.py --write-credentials local/credentials/handoff.json
```
