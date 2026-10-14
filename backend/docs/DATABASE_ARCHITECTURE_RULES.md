# School ERP — Database Architecture Rules (all 480 sidebar modules)

**Status:** Canonical delivery rules (14 October 2026)  
**Verified baseline (re-checked 14 Oct 2026):** PostgreSQL `qmis_erp`, Alembic head **`0012_students_student_user_id`**, **48** application tables matching SQLAlchemy `Base.metadata` exactly (plus `alembic_version`; no extras / no missing). Additive column: `students.student_user_id`.

These rules apply before any new role panel, API, or migration work. They override the mistaken idea that 480 sidebar rows require 480 tables.

---

## Core principle

The **480 modules** are sidebar entries across role panels, **not** 480 independent database entities. Multiple roles may use the same frontend feature, backend API, and tables with different permissions and views.

Frontend role configuration (`roleKey`, routes, labels) is for **presentation only**. **Backend permission checks are the security boundary.**

---

## 1. Reuse existing domain functionality

Before implementing any module:

1. Identify its role, feature, API endpoints, models, and migration history.
2. Check whether the same domain already exists for another role.
3. Reuse existing APIs and tables when the business data is shared.
4. Add role-specific filtering and backend permissions where necessary.
5. Never treat frontend checks as authorisation.

**Shared domains (reuse first):** Announcements, Calendar, Communication, Notifications, Leave, Tasks, Escalations, Admissions, Students, Documents, TC, Activities, Masters/Classes, Auth/RBAC, and Front Office campus records (`front_office_records`) where the same business object applies.

Evidence map: [`MODULE_DOMAIN_MAPPING.md`](MODULE_DOMAIN_MAPPING.md).

---

## 2. Add tables only when required

Create or extend tables **only** when a confirmed business requirement needs new persistent data, relationships, constraints, or history.

Typical *future* domain-specific areas (check existing models first; do not duplicate):

| Domain | Possible persistence | Already present (partial) |
|---|---|---|
| Finance | accounts, transactions, fee allocations, reconciliation | `finance_records` (collection-style) |
| HR | payroll extras, deeper employee history | `hr_employees`, `hr_records` |
| Transport | routes, vehicles, assignments, GPS | not dedicated yet |
| Hostel / Canteen | allocation, menus, inventory | Front Office hostel gate pass is campus JSON; canteen not dedicated |
| Audit | templates, findings, corrective actions | `audit_logs` (API audit trail only) |

Do **not** create a new model because a different role needs the same feature.

---

## 3. Table-count estimates are planning only

| Figure | Meaning |
|---|---|
| **~48 tables @ `0012`** | Verified baseline for shared core + Admin campus + PRM Front Office + student portal login link |
| **~80–150 tables (full ERP)** | Planning estimate for later Finance/Transport/Canteen/Audit depth — **not a target** |

Do **not** add tables merely to reach a count. Always verify migration head and live schema before quoting numbers:

```bash
cd backend
alembic current
# expect 0012_students_student_user_id (or newer when migrations are added)
```

---

## 4. Migration process (mandatory for schema change)

For each confirmed schema change:

1. Update SQLAlchemy models and Pydantic/API schemas consistently.
2. Add an Alembic revision (prefer additive / abort-safe patterns used in `0002`–`0012`).
3. Preserve existing records; define FKs, indexes, uniqueness, and deletion/downgrade rules.
4. Test upgrade on a safe development or throwaway copy — never destructive tests on production.
5. Verify persistence and retrieval through the API (not HTTP 200 alone).
6. Extend `schema_check` when a new revision introduces tables that must exist at that head.
7. Refresh Archify / architecture docs when new routers mount in `main.py`.

Startup may run `create_all` for **missing** tables only; it does **not** replace Alembic for alters.

---

## 5. Module-to-domain mapping

Maintain [`MODULE_DOMAIN_MAPPING.md`](MODULE_DOMAIN_MAPPING.md) with, for each sidebar module:

- Role and module name  
- Shared vs role-specific domain  
- Frontend route / component  
- Backend endpoint and permission  
- Table(s)  
- Migration required?  
- Verification status (PASS / PARTIAL / NOT RUN)

Update that file when a role panel is completed or a new domain is introduced.

---

## 6. Final decision rule (every module)

**Does the required business domain and API already exist?**

| Answer | Action |
|---|---|
| **Yes** | Reuse API + tables; connect FE; enforce permissions; test |
| **Partially** | Extend existing implementation; do not duplicate data |
| **No** | Design domain + API first; migrate **only** if persistence is required |

Inspect the codebase and migrations before changing schema. Preserve existing frontend UI. Avoid unnecessary database complexity.

---

## Related documents

| Doc | Role |
|---|---|
| [`MODULE_DOMAIN_MAPPING.md`](MODULE_DOMAIN_MAPPING.md) | Module ↔ domain ↔ table map |
| [`DATABASE_INTEGRATION_AUDIT.md`](DATABASE_INTEGRATION_AUDIT.md) | Connectivity, config, Admin persistence audit |
| [`ADMINISTRATOR_MODULE_AUDIT.md`](ADMINISTRATOR_MODULE_AUDIT.md) | Admin 26-module scorecard |
| [`PRM_NEXT_STEPS.md`](PRM_NEXT_STEPS.md) | PRM Front Office delivery notes |
| [`ARCHITECTURE_OVERVIEW.md`](ARCHITECTURE_OVERVIEW.md) | Archify project overview |
| Role-module Word sheet | Sidebar Completed / Partial / Not Completed counts |
