"""Admin > Announcement: announcements, acknowledgements and replies (new tables only).

Adds ``announcements``, ``announcement_responses`` and ``announcement_replies``. Nothing existing is
changed. Safe to run twice. ``downgrade`` refuses while any of the tables holds rows. An announcement's
attachment stays in ``file_assets`` and the uploads folder.

Revision ID: 0006_announcements
Revises: 0005_document_records
Create Date: 2026-10-14
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0006_announcements"
down_revision = "0005_document_records"
branch_labels = None
depends_on = None

TABLES = ["announcements", "announcement_responses", "announcement_replies"]  # parent first


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
