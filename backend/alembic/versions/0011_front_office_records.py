"""PRM Front Office campus records (gate passes, transfer, re-enrollment).

Revision ID: 0011_front_office_records
Revises: 0010_communication
Create Date: 2026-10-14
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0011_front_office_records"
down_revision = "0010_communication"
branch_labels = None
depends_on = None

TABLES = ["front_office_records"]


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
