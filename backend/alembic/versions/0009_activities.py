"""Cultural, sports and competition activities (new tables only).

Revision ID: 0009_activities
Revises: 0008_tc_requests
Create Date: 2026-10-14
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0009_activities"
down_revision = "0008_tc_requests"
branch_labels = None
depends_on = None

TABLES = ["activities", "activity_players"]


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
