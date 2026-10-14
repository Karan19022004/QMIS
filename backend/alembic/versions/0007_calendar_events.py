"""Academic calendar events (new table only).

Revision ID: 0007_calendar_events
Revises: 0006_announcements
Create Date: 2026-10-14
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0007_calendar_events"
down_revision = "0006_announcements"
branch_labels = None
depends_on = None

TABLES = ["calendar_events"]


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
