"""hr_employees.user_id: VARCHAR(36) -> UUID, with the foreign key to users.id the model declares.

Why this exists: the model declares ``user_id`` as a UUID foreign key to ``users.id``, but older
databases got the column from ``ensure_hr_employee_columns`` as a plain ``VARCHAR(36)`` with no
foreign key (``create_all`` never alters an existing table). PostgreSQL then refuses
``user_id = <uuid>`` (``character varying = uuid``), which is a 500 for every role that is not
allowed to see all employees.

Safety rules (PostgreSQL only; any other database already has the right shape from ``create_all``):
  * the whole revision is one transaction, so any failed check rolls everything back;
  * the table is locked first, so nothing can change between validation and conversion;
  * nothing is discarded: blank strings (which carry no link) become NULL and are counted; any
    other value that is not a UUID, or that names no existing user, ABORTS the migration and is
    listed so a person can decide, rather than being nulled out;
  * after converting, every employee row and every link is compared with a snapshot taken before.

Revision ID: 0002_hr_user_id_uuid
Revises: 0001_baseline
Create Date: 2026-10-13
"""

import logging

import sqlalchemy as sa
from alembic import op

revision = "0002_hr_user_id_uuid"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")

_UUID_RE = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
_FK_NAME = "hr_employees_user_id_fkey"


class MigrationAborted(RuntimeError):
    """Raised when existing data cannot be converted without losing information."""


def _column_type(conn) -> str | None:
    return conn.execute(
        sa.text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = 'hr_employees' AND column_name = 'user_id'"
        )
    ).scalar()


def _has_user_fk(conn) -> bool:
    return bool(
        conn.execute(
            sa.text(
                "SELECT 1 FROM pg_constraint WHERE conrelid = 'hr_employees'::regclass AND contype = 'f' "
                "AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (user_id) REFERENCES users(id)%'"
            )
        ).first()
    )


def _lines(rows) -> str:
    return "; ".join(f"{code} -> {value!r}" for code, value in rows)


def upgrade_connection(conn) -> dict:
    """Convert on an open connection/transaction. Returns what was done (used by tests and logs)."""
    result = {"converted": False, "foreign_key_added": False, "blank_to_null": 0, "rows": 0, "links": 0}
    if conn.dialect.name != "postgresql":
        return result
    column_type = _column_type(conn)
    if column_type is None:  # the table (or column) does not exist yet: create_all will build it right
        return result

    conn.execute(sa.text("SET LOCAL lock_timeout = '15s'"))
    conn.execute(sa.text("LOCK TABLE hr_employees IN ACCESS EXCLUSIVE MODE"))

    if column_type != "uuid":
        if column_type not in ("character varying", "text", "character"):
            raise MigrationAborted(f"hr_employees.user_id has unexpected type {column_type!r}; not changing it.")

        bad = conn.execute(
            sa.text(
                "SELECT employee_code, user_id FROM hr_employees "
                "WHERE user_id IS NOT NULL AND btrim(user_id) <> '' AND btrim(user_id) !~ :re ORDER BY employee_code"
            ),
            {"re": _UUID_RE},
        ).all()
        if bad:
            raise MigrationAborted(
                "These employees have a user_id that is not a UUID. Nothing was changed. "
                f"Fix or clear them by hand, then run the migration again: {_lines(bad)}"
            )
        orphans = conn.execute(
            sa.text(
                "SELECT h.employee_code, h.user_id FROM hr_employees h WHERE h.user_id IS NOT NULL "
                "AND btrim(h.user_id) <> '' AND NOT EXISTS "
                "(SELECT 1 FROM users u WHERE u.id::text = lower(btrim(h.user_id))) ORDER BY h.employee_code"
            )
        ).all()
        if orphans:
            raise MigrationAborted(
                "These employees point at a login that does not exist. Nothing was changed. "
                f"Fix or clear them by hand, then run the migration again: {_lines(orphans)}"
            )

        result["rows"] = conn.execute(sa.text("SELECT count(*) FROM hr_employees")).scalar()
        result["blank_to_null"] = conn.execute(
            sa.text("SELECT count(*) FROM hr_employees WHERE user_id IS NOT NULL AND btrim(user_id) = ''")
        ).scalar()
        # snapshot of every real link, in canonical (lower-case) form, to compare against afterwards
        conn.execute(
            sa.text(
                "CREATE TEMP TABLE _hr_user_id_before ON COMMIT DROP AS "
                "SELECT id, lower(btrim(user_id)) AS user_id FROM hr_employees WHERE btrim(coalesce(user_id, '')) <> ''"
            )
        )
        result["links"] = conn.execute(sa.text("SELECT count(*) FROM _hr_user_id_before")).scalar()

        conn.execute(
            sa.text(
                "ALTER TABLE hr_employees ALTER COLUMN user_id TYPE uuid "
                "USING NULLIF(btrim(user_id), '')::uuid"
            )
        )

        rows_after = conn.execute(sa.text("SELECT count(*) FROM hr_employees")).scalar()
        links_after = conn.execute(sa.text("SELECT count(*) FROM hr_employees WHERE user_id IS NOT NULL")).scalar()
        changed = conn.execute(
            sa.text(
                "SELECT count(*) FROM _hr_user_id_before b LEFT JOIN hr_employees h ON h.id = b.id "
                "WHERE h.user_id::text IS DISTINCT FROM b.user_id"
            )
        ).scalar()
        if rows_after != result["rows"] or links_after != result["links"] or changed:
            raise MigrationAborted(
                f"Verification failed (rows {result['rows']}->{rows_after}, links {result['links']}->{links_after}, "
                f"changed {changed}). The transaction is rolled back; nothing was changed."
            )
        result["converted"] = True
        log.info(
            "hr_employees.user_id converted to uuid: %s rows, %s links kept, %s blank value(s) became NULL",
            result["rows"], result["links"], result["blank_to_null"],
        )

    if not _has_user_fk(conn):
        orphans = conn.execute(
            sa.text(
                "SELECT h.employee_code, h.user_id::text FROM hr_employees h WHERE h.user_id IS NOT NULL "
                "AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = h.user_id) ORDER BY h.employee_code"
            )
        ).all()
        if orphans:
            raise MigrationAborted(
                "These employees point at a login that does not exist, so the foreign key cannot be added. "
                f"Nothing was changed: {_lines(orphans)}"
            )
        conn.execute(
            sa.text(f"ALTER TABLE hr_employees ADD CONSTRAINT {_FK_NAME} FOREIGN KEY (user_id) REFERENCES users(id)")
        )
        result["foreign_key_added"] = True
    return result


def downgrade_connection(conn) -> dict:
    """Return to the old shape (VARCHAR(36), no foreign key). Values are kept as their text form."""
    result = {"reverted": False}
    if conn.dialect.name != "postgresql" or _column_type(conn) != "uuid":
        return result
    conn.execute(sa.text("SET LOCAL lock_timeout = '15s'"))
    conn.execute(sa.text("LOCK TABLE hr_employees IN ACCESS EXCLUSIVE MODE"))
    conn.execute(sa.text(f"ALTER TABLE hr_employees DROP CONSTRAINT IF EXISTS {_FK_NAME}"))
    conn.execute(sa.text("ALTER TABLE hr_employees ALTER COLUMN user_id TYPE varchar(36) USING user_id::text"))
    result["reverted"] = True
    return result


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
