"""Startup check: warn (never block) when the database is behind the code.

`create_all` builds missing tables but never alters existing ones, so a database created before a
schema change keeps its old shape. Pending Alembic revisions are applied on purpose with
`alembic upgrade head` (after a backup), never silently at startup. This only makes the gap visible,
instead of surfacing later as an unexplained 500.
"""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text

from app.core.database import engine

log = logging.getLogger("uvicorn.error")

# Tables introduced by Admin campus migrations. Only required when alembic_version is at/after
# that revision (so fixtures stopped at 0003/0004 stay quiet after their scoped upgrade).
_ADMIN_TABLES_BY_REVISION: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("0005_document_records", ("document_records", "document_items")),
    ("0006_announcements", ("announcements", "announcement_responses", "announcement_replies")),
    ("0007_calendar_events", ("calendar_events",)),
    ("0008_tc_requests", ("tc_requests",)),
    ("0009_activities", ("activities", "activity_players")),
    (
        "0010_communication",
        ("conversations", "conversation_participants", "messages"),
    ),
    ("0011_front_office_records", ("front_office_records",)),
)

_REVISION_ORDER = (
    "0001_baseline",
    "0002_hr_employees_user_id_uuid",
    "0003_school_classes_academic_year_uuid",
    "0004_class_details_fields",
    *[rev for rev, _ in _ADMIN_TABLES_BY_REVISION],
)


def _alembic_revision(inspector) -> str | None:
    if not inspector.has_table("alembic_version"):
        return None
    try:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
        return str(row[0]) if row and row[0] else None
    except Exception:
        return None


def _required_admin_tables(revision: str | None) -> list[str]:
    if not revision or revision not in _REVISION_ORDER:
        return []
    idx = _REVISION_ORDER.index(revision)
    required: list[str] = []
    for rev, tables in _ADMIN_TABLES_BY_REVISION:
        if rev not in _REVISION_ORDER:
            continue
        if _REVISION_ORDER.index(rev) <= idx:
            required.extend(tables)
    return required


def pending_schema_problems() -> list[str]:
    """Return human-readable descriptions of known schema drift (empty list = up to date)."""
    problems: list[str] = []
    if engine.dialect.name != "postgresql":
        return problems
    inspector = inspect(engine)
    for table, column_name, consequence in (
        (
            "hr_employees",
            "user_id",
            "HR 'own record' lookups fail with a 500 for non-HR users",
        ),
        (
            "school_classes",
            "academic_year_id",
            "filtering classes by academic year fails with a 500",
        ),
    ):
        if not inspector.has_table(table):
            continue
        column = next((c for c in inspector.get_columns(table) if c["name"] == column_name), None)
        if column is not None and "uuid" not in str(column["type"]).lower():
            problems.append(
                f"{table}.{column_name} is not a UUID column, so {consequence}. "
                "Back up the database, then run `alembic upgrade head`."
            )
    for table, column_name, consequence in (
        ("sections", "class_teacher_user_id", "listing sections fails with a 500"),
        ("sections", "capacity", "listing sections fails with a 500"),
        ("sections", "room_number", "listing sections fails with a 500"),
        ("school_classes", "is_active", "listing classes fails with a 500"),
    ):
        if not inspector.has_table(table):
            continue
        if not any(c["name"] == column_name for c in inspector.get_columns(table)):
            problems.append(
                f"{table}.{column_name} does not exist yet, so {consequence}. "
                "Back up the database, then run `alembic upgrade head`."
            )
    for table in _required_admin_tables(_alembic_revision(inspector)):
        if not inspector.has_table(table):
            problems.append(
                f"table {table} is missing (Alembic revision expects it), so the matching "
                "Administrator API will fail. Back up the database, then run `alembic upgrade head`."
            )
    return problems


def warn_if_schema_behind() -> None:
    try:
        for problem in pending_schema_problems():
            log.warning("DATABASE SCHEMA BEHIND: %s", problem)
    except Exception:  # a diagnostic must never stop the app from starting
        log.exception("Schema check could not run")
