"""Campus ops_records + audit_records JSON collection tables.

Revision ID: 0014_ops_and_audit_records
Revises: 0013_academics_records
Create Date: 2026-10-17
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0014_ops_and_audit_records"
down_revision = "0013_academics_records"
branch_labels = None
depends_on = None

TABLES = ["ops_records", "audit_records"]


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
