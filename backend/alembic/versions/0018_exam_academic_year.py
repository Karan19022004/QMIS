"""Add academic_year to exams for year-scoped mark entry / forwarding.

Revision ID: 0018_exam_academic_year
Revises: 0017_student_placement
Create Date: 2026-10-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0018_exam_academic_year"
down_revision = "0017_student_placement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())
    if "exams" not in tables:
        return
    cols = {c["name"] for c in inspector.get_columns("exams")}
    if "academic_year" not in cols:
        op.add_column("exams", sa.Column("academic_year", sa.String(length=40), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())
    if "exams" not in tables:
        return
    cols = {c["name"] for c in inspector.get_columns("exams")}
    if "academic_year" in cols:
        op.drop_column("exams", "academic_year")
