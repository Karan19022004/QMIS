"""school_classes.academic_year_id: VARCHAR(36) -> UUID, with the foreign key to academic_years.id.

Why this exists: the model declares ``academic_year_id`` as a nullable UUID foreign key to
``academic_years.id``, but databases that already had a ``school_classes`` table got the column from
``ensure_masters_schema`` as a plain ``VARCHAR(36)`` with no foreign key (``create_all`` never alters
an existing table). PostgreSQL then refuses ``academic_year_id = <uuid>`` (``character varying =
uuid``), so ``GET /masters/classes?academic_year_id=...`` returned 500.

Safety rules (PostgreSQL only; other databases already have the right shape from ``create_all``):
  * one transaction, so any failed check rolls everything back;
  * the table is locked first, so nothing changes between validation and conversion;
  * nothing is discarded: blank strings (no link) become NULL and are counted; a value that is not a
    UUID, that names no existing academic year, or that names a year on a DIFFERENT campus than the
    class ABORTS the migration and is listed, rather than being nulled out or "fixed";
  * after converting, every class row and every link is compared with a snapshot taken before.

Revision ID: 0003_class_year_uuid
Revises: 0002_hr_user_id_uuid
Create Date: 2026-10-13
"""

import logging

import sqlalchemy as sa
from alembic import op

revision = "0003_class_year_uuid"
down_revision = "0002_hr_user_id_uuid"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")

_UUID_RE = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
_FK_NAME = "school_classes_academic_year_id_fkey"


class MigrationAborted(RuntimeError):
    """Raised when existing data cannot be converted without losing or guessing information."""


def _column_type(conn) -> str | None:
    return conn.execute(
        sa.text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = 'school_classes' "
            "AND column_name = 'academic_year_id'"
        )
    ).scalar()


def _has_year_fk(conn) -> bool:
    return bool(
        conn.execute(
            sa.text(
                "SELECT 1 FROM pg_constraint WHERE conrelid = 'school_classes'::regclass AND contype = 'f' "
                "AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)%'"
            )
        ).first()
    )


def _lines(rows) -> str:
    return "; ".join(f"{name} -> {value!r}" for name, value in rows)


def _check_references(conn, as_text: bool) -> None:
    """Abort on a link to a missing academic year or to one on another campus."""
    year_match = "a.id::text = lower(btrim(s.academic_year_id))" if as_text else "a.id = s.academic_year_id"
    present = "btrim(s.academic_year_id) <> ''" if as_text else "TRUE"
    value = "s.academic_year_id" if as_text else "s.academic_year_id::text"
    orphans = conn.execute(
        sa.text(
            f"SELECT s.name, {value} FROM school_classes s WHERE s.academic_year_id IS NOT NULL AND {present} "
            f"AND NOT EXISTS (SELECT 1 FROM academic_years a WHERE {year_match}) ORDER BY s.name"
        )
    ).all()
    if orphans:
        raise MigrationAborted(
            "These classes point at an academic year that does not exist. Nothing was changed. "
            f"Fix or clear them by hand, then run the migration again: {_lines(orphans)}"
        )
    cross = conn.execute(
        sa.text(
            f"SELECT s.name, {value} FROM school_classes s JOIN academic_years a ON {year_match} "
            f"WHERE s.academic_year_id IS NOT NULL AND {present} AND a.campus_id <> s.campus_id ORDER BY s.name"
        )
    ).all()
    if cross:
        raise MigrationAborted(
            "These classes point at an academic year that belongs to a different campus. Nothing was "
            f"changed. Fix or clear them by hand, then run the migration again: {_lines(cross)}"
        )


def upgrade_connection(conn) -> dict:
    """Convert on an open connection/transaction. Returns what was done (used by tests and logs)."""
    result = {"converted": False, "foreign_key_added": False, "blank_to_null": 0, "rows": 0, "links": 0}
    if conn.dialect.name != "postgresql":
        return result
    column_type = _column_type(conn)
    if column_type is None:  # table or column not there yet: create_all will build it correctly
        return result

    conn.execute(sa.text("SET LOCAL lock_timeout = '15s'"))
    conn.execute(sa.text("LOCK TABLE school_classes IN ACCESS EXCLUSIVE MODE"))

    if column_type != "uuid":
        if column_type not in ("character varying", "text", "character"):
            raise MigrationAborted(
                f"school_classes.academic_year_id has unexpected type {column_type!r}; not changing it."
            )
        bad = conn.execute(
            sa.text(
                "SELECT name, academic_year_id FROM school_classes WHERE academic_year_id IS NOT NULL "
                "AND btrim(academic_year_id) <> '' AND btrim(academic_year_id) !~ :re ORDER BY name"
            ),
            {"re": _UUID_RE},
        ).all()
        if bad:
            raise MigrationAborted(
                "These classes have an academic_year_id that is not a UUID. Nothing was changed. "
                f"Fix or clear them by hand, then run the migration again: {_lines(bad)}"
            )
        _check_references(conn, as_text=True)

        result["rows"] = conn.execute(sa.text("SELECT count(*) FROM school_classes")).scalar()
        result["blank_to_null"] = conn.execute(
            sa.text("SELECT count(*) FROM school_classes WHERE academic_year_id IS NOT NULL AND btrim(academic_year_id) = ''")
        ).scalar()
        conn.execute(
            sa.text(
                "CREATE TEMP TABLE _class_year_before ON COMMIT DROP AS "
                "SELECT id, lower(btrim(academic_year_id)) AS academic_year_id FROM school_classes "
                "WHERE btrim(coalesce(academic_year_id, '')) <> ''"
            )
        )
        result["links"] = conn.execute(sa.text("SELECT count(*) FROM _class_year_before")).scalar()

        conn.execute(
            sa.text(
                "ALTER TABLE school_classes ALTER COLUMN academic_year_id TYPE uuid "
                "USING NULLIF(btrim(academic_year_id), '')::uuid"
            )
        )

        rows_after = conn.execute(sa.text("SELECT count(*) FROM school_classes")).scalar()
        links_after = conn.execute(
            sa.text("SELECT count(*) FROM school_classes WHERE academic_year_id IS NOT NULL")
        ).scalar()
        changed = conn.execute(
            sa.text(
                "SELECT count(*) FROM _class_year_before b LEFT JOIN school_classes s ON s.id = b.id "
                "WHERE s.academic_year_id::text IS DISTINCT FROM b.academic_year_id"
            )
        ).scalar()
        if rows_after != result["rows"] or links_after != result["links"] or changed:
            raise MigrationAborted(
                f"Verification failed (rows {result['rows']}->{rows_after}, links {result['links']}->{links_after}, "
                f"changed {changed}). The transaction is rolled back; nothing was changed."
            )
        result["converted"] = True
        log.info(
            "school_classes.academic_year_id converted to uuid: %s rows, %s links kept, %s blank value(s) became NULL",
            result["rows"], result["links"], result["blank_to_null"],
        )

    if not _has_year_fk(conn):
        _check_references(conn, as_text=False)
        conn.execute(
            sa.text(
                f"ALTER TABLE school_classes ADD CONSTRAINT {_FK_NAME} "
                "FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)"
            )
        )
        result["foreign_key_added"] = True
    return result


def downgrade_connection(conn) -> dict:
    """Return to the old shape (VARCHAR(36), no foreign key). Values are kept as their text form."""
    result = {"reverted": False}
    if conn.dialect.name != "postgresql" or _column_type(conn) != "uuid":
        return result
    conn.execute(sa.text("SET LOCAL lock_timeout = '15s'"))
    conn.execute(sa.text("LOCK TABLE school_classes IN ACCESS EXCLUSIVE MODE"))
    conn.execute(sa.text(f"ALTER TABLE school_classes DROP CONSTRAINT IF EXISTS {_FK_NAME}"))
    conn.execute(sa.text("ALTER TABLE school_classes ALTER COLUMN academic_year_id TYPE varchar(36) USING academic_year_id::text"))
    result["reverted"] = True
    return result


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
