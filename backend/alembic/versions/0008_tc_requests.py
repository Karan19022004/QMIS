"""Transfer certificate requests (new table only).

Revision ID: 0008_tc_requests
Revises: 0007_calendar_events
Create Date: 2026-10-14
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0008_tc_requests"
down_revision = "0007_calendar_events"
branch_labels = None
depends_on = None

TABLES = ["tc_requests"]


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
