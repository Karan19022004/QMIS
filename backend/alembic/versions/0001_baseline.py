"""Baseline: the schema as built by create_all plus the ensure_* helpers up to 13 Oct 2026.

This revision changes nothing. It only gives every existing database a starting point, so that
`alembic upgrade head` works on a database that predates Alembic (no `alembic_version` table yet)
without any manual stamping.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-13
"""

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
