"""Store student portal email on admissions (like parent_account_email).

Revision ID: 0015_admission_student_email
Revises: 0014_ops_and_audit_records
Create Date: 2026-10-18
"""

import sqlalchemy as sa
from alembic import op

revision = "0015_admission_student_email"
down_revision = "0014_ops_and_audit_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "admissions" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("admissions")}
    if "student_account_email" in cols:
        return
    op.add_column("admissions", sa.Column("student_account_email", sa.String(255), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "admissions" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("admissions")}
    if "student_account_email" not in cols:
        return
    op.drop_column("admissions", "student_account_email")
