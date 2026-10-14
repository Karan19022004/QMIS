"""Safe helpers for Alembic revisions that only ADD tables.

Rules the revisions built on this follow:
  * only tables that do not exist yet are created, so running a revision twice, or on a database where
    ``create_all`` already built the tables, changes nothing;
  * existing tables and rows are never altered;
  * a downgrade refuses (changing nothing) while any of the tables holds rows, so a rollback can never
    silently discard business data.

The tables are created from the current model definitions. If one of these tables is changed later, do it
in a new revision that is itself idempotent.
"""

import sqlalchemy as sa


class MigrationAborted(RuntimeError):
    """Raised when the change cannot be made without losing information."""


def create_missing_tables(conn, table_names: list[str]) -> list[str]:
    """Create each named table that is missing (list them in dependency order). Returns what was created."""
    from app.models import Base

    inspector = sa.inspect(conn)
    created: list[str] = []
    for name in table_names:
        if name not in Base.metadata.tables:
            raise MigrationAborted(f"Unknown table {name!r}; the models do not define it.")
        if not inspector.has_table(name):
            Base.metadata.tables[name].create(conn)
            created.append(name)
            inspector = sa.inspect(conn)
    return created


def drop_tables_if_empty(conn, table_names: list[str]) -> list[str]:
    """Drop the named tables (list them child-first), but only when every one of them is empty."""
    inspector = sa.inspect(conn)
    present = [name for name in table_names if inspector.has_table(name)]
    filled = {
        name: conn.execute(sa.text(f'SELECT count(*) FROM "{name}"')).scalar() for name in present
    }
    filled = {name: count for name, count in filled.items() if count}
    if filled:
        raise MigrationAborted(
            "Downgrade refused; nothing was changed. These tables still hold data that would be lost: "
            + ", ".join(f"{name} ({count} row(s))" for name, count in filled.items())
            + ". Export or clear that data first, then downgrade again."
        )
    for name in present:
        conn.execute(sa.text(f'DROP TABLE "{name}"'))
    return present
