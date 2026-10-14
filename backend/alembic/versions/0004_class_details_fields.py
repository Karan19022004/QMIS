"""Class Details: capacity, room and class teacher on sections; classes unique per academic year.

What changes (PostgreSQL only; other databases get the right shape from ``create_all``):
  * ``sections.capacity`` (integer, > 0), ``sections.room_number`` (varchar 20) and
    ``sections.class_teacher_user_id`` (uuid, foreign key to ``users.id``), all nullable;
  * ``school_classes.is_active`` (boolean, default true) so a class is deactivated, not deleted;
  * ``school_classes.academic_year_id`` becomes NOT NULL, and the unique rule changes from
    (campus, name) to (campus, academic year, name), so the same class can run again in a later year
    while the database still refuses a duplicate inside one year, even for concurrent requests.

Safety rules (same spirit as 0002 and 0003):
  * one transaction, tables locked first, so a failed check rolls everything back;
  * nothing is guessed: a class with no academic year is given one ONLY when its campus has exactly
    one academic year (it can belong to no other). With more than one, the migration ABORTS and lists
    the classes, so a person decides;
  * after the change, row counts are compared with a snapshot taken first;
  * running it again does nothing;
  * ``downgrade`` refuses (changing nothing) if it would discard data: any capacity, room or class
    teacher, any deactivated class, or the same class name in two years.

Revision ID: 0004_class_details_fields
Revises: 0003_class_year_uuid
Create Date: 2026-10-14
"""

import logging

import sqlalchemy as sa
from alembic import op

revision = "0004_class_details_fields"
down_revision = "0003_class_year_uuid"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")

_NEW_UNIQUE = "uq_school_class_campus_year_name"
_OLD_UNIQUE = "school_classes_campus_id_name_key"
_CAPACITY_CHECK = "ck_sections_capacity_positive"
_TEACHER_INDEX = "ix_sections_class_teacher_user_id"


class MigrationAborted(RuntimeError):
    """Raised when the change cannot be made without losing or guessing information."""


def _has_table(conn, table: str) -> bool:
    return bool(
        conn.execute(
            sa.text("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = :t"),
            {"t": table},
        ).first()
    )


def _column(conn, table: str, column: str):
    return conn.execute(
        sa.text(
            "SELECT data_type, is_nullable FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).first()


def _constraint_exists(conn, table: str, name: str) -> bool:
    return bool(
        conn.execute(
            sa.text("SELECT 1 FROM pg_constraint WHERE conrelid = CAST(:t AS regclass) AND conname = :n"),
            {"t": table, "n": name},
        ).first()
    )


def _unique_on(conn, table: str, columns: list[str]) -> list[str]:
    """Names of unique constraints whose columns are exactly ``columns`` (any order)."""
    rows = conn.execute(
        sa.text(
            "SELECT c.conname, array_agg(a.attname ORDER BY a.attname) "
            "FROM pg_constraint c "
            "JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) "
            "WHERE c.conrelid = CAST(:t AS regclass) AND c.contype = 'u' GROUP BY c.conname"
        ),
        {"t": table},
    ).all()
    wanted = sorted(columns)
    return [name for name, cols in rows if sorted(cols) == wanted]


def _lock(conn) -> None:
    conn.execute(sa.text("SET LOCAL lock_timeout = '15s'"))
    conn.execute(sa.text("LOCK TABLE school_classes, sections IN ACCESS EXCLUSIVE MODE"))


def upgrade_connection(conn) -> dict:
    """Apply on an open connection/transaction. Returns what was done (used by tests and logs)."""
    result = {
        "columns_added": [],
        "year_backfilled": 0,
        "year_set_not_null": False,
        "unique_replaced": False,
        "classes": 0,
        "sections": 0,
    }
    if conn.dialect.name != "postgresql":
        return result
    if not (_has_table(conn, "school_classes") and _has_table(conn, "sections")):
        return result  # create_all will build both with the right shape

    year = _column(conn, "school_classes", "academic_year_id")
    if year is None or year[0] != "uuid":
        raise MigrationAborted(
            "school_classes.academic_year_id is not a UUID column. Run revision 0003 first. Nothing was changed."
        )

    _lock(conn)
    result["classes"] = conn.execute(sa.text("SELECT count(*) FROM school_classes")).scalar()
    result["sections"] = conn.execute(sa.text("SELECT count(*) FROM sections")).scalar()

    # 1. new columns -------------------------------------------------------------------------
    for table, column, ddl in (
        ("sections", "capacity", "ALTER TABLE sections ADD COLUMN capacity integer"),
        ("sections", "room_number", "ALTER TABLE sections ADD COLUMN room_number varchar(20)"),
        (
            "sections",
            "class_teacher_user_id",
            "ALTER TABLE sections ADD COLUMN class_teacher_user_id uuid REFERENCES users(id)",
        ),
        (
            "school_classes",
            "is_active",
            "ALTER TABLE school_classes ADD COLUMN is_active boolean NOT NULL DEFAULT true",
        ),
    ):
        if _column(conn, table, column) is None:
            conn.execute(sa.text(ddl))
            result["columns_added"].append(f"{table}.{column}")
    conn.execute(sa.text(f"CREATE INDEX IF NOT EXISTS {_TEACHER_INDEX} ON sections (class_teacher_user_id)"))
    if not _constraint_exists(conn, "sections", _CAPACITY_CHECK):
        conn.execute(
            sa.text(
                f"ALTER TABLE sections ADD CONSTRAINT {_CAPACITY_CHECK} CHECK (capacity IS NULL OR capacity > 0)"
            )
        )

    # 2. every class needs an academic year -----------------------------------------------------
    undecided = conn.execute(
        sa.text(
            "SELECT s.name, s.campus_id::text, "
            "(SELECT count(*) FROM academic_years a WHERE a.campus_id = s.campus_id) "
            "FROM school_classes s WHERE s.academic_year_id IS NULL ORDER BY s.name"
        )
    ).all()
    ambiguous = [(name, campus, n) for name, campus, n in undecided if n != 1]
    if ambiguous:
        raise MigrationAborted(
            "These classes have no academic year and their campus does not have exactly one, so the right "
            "year cannot be known. Nothing was changed. Set their academic year by hand, then run the "
            "migration again: " + "; ".join(f"{name} (campus {campus} has {n} years)" for name, campus, n in ambiguous)
        )
    if undecided:
        result["year_backfilled"] = conn.execute(
            sa.text(
                "UPDATE school_classes s SET academic_year_id = "
                "(SELECT a.id FROM academic_years a WHERE a.campus_id = s.campus_id) "
                "WHERE s.academic_year_id IS NULL"
            )
        ).rowcount
    if year[1] == "YES":
        conn.execute(sa.text("ALTER TABLE school_classes ALTER COLUMN academic_year_id SET NOT NULL"))
        result["year_set_not_null"] = True

    # 3. unique per (campus, academic year, name) -------------------------------------------
    if not _constraint_exists(conn, "school_classes", _NEW_UNIQUE):
        duplicates = conn.execute(
            sa.text(
                "SELECT name, academic_year_id::text, count(*) FROM school_classes "
                "GROUP BY campus_id, academic_year_id, name HAVING count(*) > 1 ORDER BY name"
            )
        ).all()
        if duplicates:
            raise MigrationAborted(
                "The same class appears more than once in one academic year. Nothing was changed. Merge or "
                "remove the copies by hand, then run the migration again: "
                + "; ".join(f"{n} x {name} (year {yr})" for name, yr, n in duplicates)
            )
        for old in _unique_on(conn, "school_classes", ["campus_id", "name"]):
            conn.execute(sa.text(f'ALTER TABLE school_classes DROP CONSTRAINT "{old}"'))
        conn.execute(
            sa.text(
                f"ALTER TABLE school_classes ADD CONSTRAINT {_NEW_UNIQUE} "
                "UNIQUE (campus_id, academic_year_id, name)"
            )
        )
        result["unique_replaced"] = True

    # 4. verify ---------------------------------------------------------------------------------
    classes_after = conn.execute(sa.text("SELECT count(*) FROM school_classes")).scalar()
    sections_after = conn.execute(sa.text("SELECT count(*) FROM sections")).scalar()
    unset = conn.execute(sa.text("SELECT count(*) FROM school_classes WHERE academic_year_id IS NULL")).scalar()
    if classes_after != result["classes"] or sections_after != result["sections"] or unset:
        raise MigrationAborted(
            f"Verification failed (classes {result['classes']}->{classes_after}, sections "
            f"{result['sections']}->{sections_after}, classes without a year {unset}). The transaction is "
            "rolled back; nothing was changed."
        )
    log.info(
        "class details: columns added %s; %s class(es) given their campus's only academic year; unique rule "
        "replaced: %s",
        result["columns_added"] or "none", result["year_backfilled"], result["unique_replaced"],
    )
    return result


def downgrade_connection(conn) -> dict:
    """Return to the 0003 shape. Refuses, changing nothing, if that would discard or merge data."""
    result = {"reverted": False}
    if conn.dialect.name != "postgresql":
        return result
    if not (_has_table(conn, "school_classes") and _has_table(conn, "sections")):
        return result
    has_new = _column(conn, "sections", "capacity") is not None or _column(conn, "school_classes", "is_active") is not None
    if not has_new and not _constraint_exists(conn, "school_classes", _NEW_UNIQUE):
        return result

    _lock(conn)
    problems: list[str] = []
    if _column(conn, "sections", "capacity") is not None:
        n = conn.execute(
            sa.text(
                "SELECT count(*) FROM sections WHERE capacity IS NOT NULL OR room_number IS NOT NULL "
                "OR class_teacher_user_id IS NOT NULL"
            )
        ).scalar()
        if n:
            problems.append(f"{n} section(s) hold a capacity, room or class teacher that would be discarded")
    if _column(conn, "school_classes", "is_active") is not None:
        n = conn.execute(sa.text("SELECT count(*) FROM school_classes WHERE NOT is_active")).scalar()
        if n:
            problems.append(f"{n} deactivated class(es) would turn active again")
    same_name = conn.execute(
        sa.text(
            "SELECT name, count(*) FROM school_classes GROUP BY campus_id, name HAVING count(*) > 1 ORDER BY name"
        )
    ).all()
    if same_name:
        problems.append(
            "the same class name exists in more than one academic year ("
            + ", ".join(f"{name} x{n}" for name, n in same_name)
            + "), which the old one-name-per-campus rule cannot hold"
        )
    if problems:
        raise MigrationAborted(
            "Downgrade refused; nothing was changed. " + "; ".join(problems)
            + ". Export or clear that data first, then downgrade again."
        )

    conn.execute(sa.text(f"ALTER TABLE school_classes DROP CONSTRAINT IF EXISTS {_NEW_UNIQUE}"))
    if not _unique_on(conn, "school_classes", ["campus_id", "name"]):
        conn.execute(sa.text(f"ALTER TABLE school_classes ADD CONSTRAINT {_OLD_UNIQUE} UNIQUE (campus_id, name)"))
    conn.execute(sa.text("ALTER TABLE school_classes ALTER COLUMN academic_year_id DROP NOT NULL"))
    conn.execute(sa.text(f"ALTER TABLE sections DROP CONSTRAINT IF EXISTS {_CAPACITY_CHECK}"))
    conn.execute(sa.text(f"DROP INDEX IF EXISTS {_TEACHER_INDEX}"))
    conn.execute(sa.text("ALTER TABLE sections DROP COLUMN IF EXISTS class_teacher_user_id"))
    conn.execute(sa.text("ALTER TABLE sections DROP COLUMN IF EXISTS room_number"))
    conn.execute(sa.text("ALTER TABLE sections DROP COLUMN IF EXISTS capacity"))
    conn.execute(sa.text("ALTER TABLE school_classes DROP COLUMN IF EXISTS is_active"))
    result["reverted"] = True
    return result


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
