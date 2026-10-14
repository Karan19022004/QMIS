"""Link enrolled students to student-portal logins (students.student_user_id).

Revision ID: 0012_students_student_user_id
Revises: 0011_front_office_records
Create Date: 2026-10-14
"""

import sqlalchemy as sa
from alembic import op

revision = "0012_students_student_user_id"
down_revision = "0011_front_office_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "students" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("students")}
    if "student_user_id" in cols:
        return
    op.add_column("students", sa.Column("student_user_id", sa.Uuid(), nullable=True))
    op.create_index("ix_students_student_user_id", "students", ["student_user_id"])
    # FK optional on SQLite test DBs; PostgreSQL gets a proper reference.
    if conn.dialect.name == "postgresql":
        op.create_foreign_key(
            "students_student_user_id_fkey",
            "students",
            "users",
            ["student_user_id"],
            ["id"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "students" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("students")}
    if "student_user_id" not in cols:
        return
    if conn.dialect.name == "postgresql":
        op.drop_constraint("students_student_user_id_fkey", "students", type_="foreignkey")
    op.drop_index("ix_students_student_user_id", table_name="students")
    op.drop_column("students", "student_user_id")
