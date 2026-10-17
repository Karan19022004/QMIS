"""Campus academics JSON collections (timetables, teacher allocations).

Revision ID: 0013_academics_records
Revises: 0012_students_student_user_id
Create Date: 2026-10-17
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0013_academics_records"
down_revision = "0012_students_student_user_id"
branch_labels = None
depends_on = None

TABLES = ["academics_records"]


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
