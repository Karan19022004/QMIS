"""Startup check: warn (never block) when the database is behind the code.

`create_all` builds missing tables but never alters existing ones, so a database created before a
schema change keeps its old shape. Pending Alembic revisions are applied on purpose with
`alembic upgrade head` (after a backup), never silently at startup. This only makes the gap visible,
instead of surfacing later as an unexplained 500.
"""

import logging

from sqlalchemy import inspect

from app.core.database import engine

log = logging.getLogger("uvicorn.error")


def pending_schema_problems() -> list[str]:
    """Return human-readable descriptions of known schema drift (empty list = up to date)."""
    problems: list[str] = []
    if engine.dialect.name != "postgresql":
        return problems
    inspector = inspect(engine)
    if inspector.has_table("hr_employees"):
        column = next((c for c in inspector.get_columns("hr_employees") if c["name"] == "user_id"), None)
        if column is not None and "uuid" not in str(column["type"]).lower():
            problems.append(
                "hr_employees.user_id is not a UUID column, so HR 'own record' lookups fail with a 500 "
                "for non-HR users. Back up the database, then run `alembic upgrade head`."
            )
    return problems


def warn_if_schema_behind() -> None:
    try:
        for problem in pending_schema_problems():
            log.warning("DATABASE SCHEMA BEHIND: %s", problem)
    except Exception:  # a diagnostic must never stop the app from starting
        log.exception("Schema check could not run")
