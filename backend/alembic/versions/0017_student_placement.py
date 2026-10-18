"""Student section/roll placement + coordinator grade bands.

Revision ID: 0017_student_placement
Revises: 0016_admission_pending_pw
Create Date: 2026-10-18
"""

import sqlalchemy as sa
from alembic import op

revision = "0017_student_placement"
down_revision = "0016_admission_pending_pw"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "students" in tables:
        cols = {c["name"] for c in inspector.get_columns("students")}
        if "academic_year_id" not in cols:
            op.add_column("students", sa.Column("academic_year_id", sa.Uuid(), nullable=True))
        if "class_id" not in cols:
            op.add_column("students", sa.Column("class_id", sa.Uuid(), nullable=True))
        if "section_id" not in cols:
            op.add_column("students", sa.Column("section_id", sa.Uuid(), nullable=True))
        if "section" not in cols:
            op.add_column("students", sa.Column("section", sa.String(20), nullable=True))
        if "roll_number" not in cols:
            op.add_column("students", sa.Column("roll_number", sa.Integer(), nullable=True))
        if "placement_status" not in cols:
            op.add_column(
                "students",
                sa.Column(
                    "placement_status",
                    sa.String(20),
                    nullable=False,
                    server_default="pending",
                ),
            )
        # Refresh cols after adds
        cols = {c["name"] for c in inspector.get_columns("students")}
        if conn.dialect.name == "postgresql":
            existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("students")}
            if "academic_year_id" in cols and "students_academic_year_id_fkey" not in existing_fks:
                op.create_foreign_key(
                    "students_academic_year_id_fkey",
                    "students",
                    "academic_years",
                    ["academic_year_id"],
                    ["id"],
                )
            if "class_id" in cols and "students_class_id_fkey" not in existing_fks:
                op.create_foreign_key(
                    "students_class_id_fkey",
                    "students",
                    "school_classes",
                    ["class_id"],
                    ["id"],
                )
            if "section_id" in cols and "students_section_id_fkey" not in existing_fks:
                op.create_foreign_key(
                    "students_section_id_fkey",
                    "students",
                    "sections",
                    ["section_id"],
                    ["id"],
                )
        inspector = sa.inspect(conn)
        indexes = {idx["name"] for idx in inspector.get_indexes("students")}
        if "ix_students_section_id" not in indexes:
            op.create_index("ix_students_section_id", "students", ["section_id"], unique=False)
        if "ix_students_placement_status" not in indexes:
            op.create_index(
                "ix_students_placement_status", "students", ["placement_status"], unique=False
            )
        if "uq_students_roll_in_section" not in indexes:
            op.create_index(
                "uq_students_roll_in_section",
                "students",
                ["campus_id", "academic_year_id", "section_id", "roll_number"],
                unique=True,
            )

    if "coordinator_grade_bands" not in tables:
        op.create_table(
            "coordinator_grade_bands",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("campus_id", sa.Uuid(), sa.ForeignKey("campuses.id"), nullable=False),
            sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("grade_from", sa.Integer(), nullable=False),
            sa.Column("grade_to", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("grade_from >= 1 AND grade_from <= 12", name="ck_band_grade_from"),
            sa.CheckConstraint("grade_to >= 1 AND grade_to <= 12", name="ck_band_grade_to"),
            sa.CheckConstraint("grade_from <= grade_to", name="ck_band_grade_range"),
            sa.UniqueConstraint("campus_id", "user_id", name="uq_coordinator_band_user"),
        )
        op.create_index("ix_coordinator_grade_bands_user_id", "coordinator_grade_bands", ["user_id"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "coordinator_grade_bands" in tables:
        op.drop_table("coordinator_grade_bands")

    if "students" in tables:
        cols = {c["name"] for c in inspector.get_columns("students")}
        for idx in ("uq_students_roll_in_section", "ix_students_placement_status", "ix_students_section_id"):
            try:
                op.drop_index(idx, table_name="students")
            except Exception:
                pass
        if conn.dialect.name == "postgresql":
            for fk in (
                "students_section_id_fkey",
                "students_class_id_fkey",
                "students_academic_year_id_fkey",
            ):
                try:
                    op.drop_constraint(fk, "students", type_="foreignkey")
                except Exception:
                    pass
        for col in (
            "placement_status",
            "roll_number",
            "section",
            "section_id",
            "class_id",
            "academic_year_id",
        ):
            if col in cols:
                op.drop_column("students", col)
