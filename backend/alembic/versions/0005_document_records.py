"""Admin > Documents: student and employee document folders (new tables only).

Adds ``document_records`` (one folder per student or employee) and ``document_items`` (one uploaded file
per document). Nothing existing is changed. Safe to run twice. ``downgrade`` refuses while either table
holds rows. Uploaded files themselves stay in the uploads folder and ``file_assets``.

Revision ID: 0005_document_records
Revises: 0004_class_details_fields
Create Date: 2026-10-14
"""

from alembic import op

from app.services.schema_helpers import create_missing_tables, drop_tables_if_empty

revision = "0005_document_records"
down_revision = "0004_class_details_fields"
branch_labels = None
depends_on = None

TABLES = ["document_records", "document_items"]  # parent first


def upgrade_connection(conn) -> dict:
    return {"created": create_missing_tables(conn, TABLES)}


def downgrade_connection(conn) -> dict:
    return {"dropped": drop_tables_if_empty(conn, list(reversed(TABLES)))}


def upgrade() -> None:
    upgrade_connection(op.get_bind())


def downgrade() -> None:
    downgrade_connection(op.get_bind())
