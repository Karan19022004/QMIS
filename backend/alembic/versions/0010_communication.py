"""Direct-message conversations and messages (new tables only).

Revision ID: 0010_communication
Revises: 0009_activities
Create Date: 2026-10-14
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0010_communication"
down_revision = "0009_activities"
branch_labels = None
depends_on = None

TABLES = ["conversations", "conversation_participants", "messages"]


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
