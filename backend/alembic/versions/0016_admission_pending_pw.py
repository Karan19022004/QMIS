"""Store hashed pending portal passwords on admissions until enroll.

Revision ID: 0016_admission_pending_pw
Revises: 0015_admission_student_email
Create Date: 2026-10-18
"""

import sqlalchemy as sa
from alembic import op

revision = "0016_admission_pending_pw"
down_revision = "0015_admission_student_email"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "admissions" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("admissions")}
    if "parent_pending_password_hash" not in cols:
        op.add_column(
            "admissions",
            sa.Column("parent_pending_password_hash", sa.String(255), nullable=True),
        )
    if "student_pending_password_hash" not in cols:
        op.add_column(
            "admissions",
            sa.Column("student_pending_password_hash", sa.String(255), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "admissions" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("admissions")}
    if "student_pending_password_hash" in cols:
        op.drop_column("admissions", "student_pending_password_hash")
    if "parent_pending_password_hash" in cols:
        op.drop_column("admissions", "parent_pending_password_hash")
