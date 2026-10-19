"""Ensure exams table has columns introduced after the baseline schema."""

from __future__ import annotations

from sqlalchemy import inspect, text

from app.core.database import engine


def ensure_exams_schema() -> None:
    """Add exams.academic_year when missing (create_all does not alter existing tables)."""
    try:
        inspector = inspect(engine)
        if not inspector.has_table("exams"):
            return
        cols = {c["name"] for c in inspector.get_columns("exams")}
        if "academic_year" in cols:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE exams ADD COLUMN academic_year VARCHAR(40)"))
    except Exception:
        # Never block API startup; Alembic 0018 covers the same change formally.
        pass
