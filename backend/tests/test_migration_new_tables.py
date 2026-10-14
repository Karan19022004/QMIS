"""Alembic revisions that only add tables (0005 onward) share one safe helper.

They create only what is missing, change nothing that exists, run twice without effect, and refuse to
downgrade while any of their tables holds rows. These tests run on in-memory SQLite, so they always run.
"""

import importlib.util
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("OTP_DEBUG", "true")
os.environ.setdefault("JWT_SECRET", "test-secret-qmis-erp-phase0-local")

import pytest
import sqlalchemy as sa
from sqlalchemy import create_engine

from app.services.schema_helpers import MigrationAborted

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def _load(filename: str):
    spec = importlib.util.spec_from_file_location(filename[:-3], VERSIONS / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MIGRATIONS = {
    "0005_document_records.py": ("document_records", "INSERT INTO document_records "
        "(id, campus_id, subject_type, employee_id, status, created_at) "
        "VALUES ('a', 'b', 'employee', 'c', 'In Progress', CURRENT_TIMESTAMP)"),
    "0006_announcements.py": ("announcements", "INSERT INTO announcements "
        "(id, campus_id, code, title, category, message, sent_by, sender_role, announcement_date, audience, "
        "created_at) VALUES ('a', 'b', 'AN-0001', 't', 'Staff Notice', 'm', 'Admin', 'admin', '2026-10-14', '[]', "
        "CURRENT_TIMESTAMP)"),
    "0007_calendar_events.py": ("calendar_events", "INSERT INTO calendar_events "
        "(id, campus_id, code, event_type, title, start_date, end_date, description, created_at) "
        "VALUES ('a', 'b', 'hol-1', 'holiday', 't', '2026-01-26', '2026-01-26', '', CURRENT_TIMESTAMP)"),
    "0008_tc_requests.py": ("tc_requests", "INSERT INTO tc_requests "
        "(id, campus_id, code, student_id, reason, transfer_to, requested_by, requested_on, status, "
        "prm_remarks, admin_remarks, tc_number, created_at) VALUES "
        "('a', 'b', 'TC-REQ-001', 'c', 'r', 's', 'Parent', '2026-10-14', 'Pending PRM Review', '', '', '', "
        "CURRENT_TIMESTAMP)"),
    "0009_activities.py": ("activities", "INSERT INTO activities "
        "(id, campus_id, code, activity_type, event_name, event_type, class_name, event_date, start_time, "
        "end_time, venue, coordinator, coach, description, submitted_by, submitted_date, md_approval_status, "
        "created_at) VALUES ('a', 'b', 'ACT-CUL-001', 'cultural', 'n', '', '', '2026-10-14', '', '', '', '', "
        "'', '', 'Admin', '2026-10-14', 'Pending', CURRENT_TIMESTAMP)"),
    "0010_communication.py": ("conversations", "INSERT INTO conversations "
        "(id, campus_id, pair_key, created_at) VALUES ('a', 'b', 'x:y', CURRENT_TIMESTAMP)"),
}


@pytest.mark.parametrize("filename", list(MIGRATIONS))
def test_revision_adds_its_tables_once_and_refuses_to_drop_data(filename):
    migration = _load(filename)
    table, insert = MIGRATIONS[filename]
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        assert migration.upgrade_connection(connection)["created"] == migration.TABLES
        assert migration.upgrade_connection(connection)["created"] == []  # second run changes nothing
        assert set(migration.TABLES) <= set(sa.inspect(connection).get_table_names())
        connection.execute(sa.text(insert))
    with engine.begin() as connection:
        with pytest.raises(MigrationAborted) as refused:
            migration.downgrade_connection(connection)
        assert table in str(refused.value) and "nothing was changed" in str(refused.value)
        assert connection.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar() == 1
        connection.execute(sa.text(f"DELETE FROM {table}"))
        assert migration.downgrade_connection(connection)["dropped"] == list(reversed(migration.TABLES))
        assert not set(migration.TABLES) & set(sa.inspect(connection).get_table_names())


@pytest.mark.parametrize("filename", list(MIGRATIONS))
def test_revision_leaves_existing_tables_alone(filename):
    migration = _load(filename)
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(sa.text(f"CREATE TABLE {migration.TABLES[0]} (id TEXT PRIMARY KEY, keep_me TEXT)"))
        connection.execute(sa.text(f"INSERT INTO {migration.TABLES[0]} VALUES ('1', 'untouched')"))
        created = migration.upgrade_connection(connection)["created"]
        assert migration.TABLES[0] not in created
        assert connection.execute(sa.text(f"SELECT keep_me FROM {migration.TABLES[0]}")).scalar() == "untouched"


def test_revisions_form_one_unbroken_chain():
    chain = {}
    for path in sorted(VERSIONS.glob("0*.py")):
        module = _load(path.name)
        chain[module.revision] = module.down_revision
    heads = set(chain) - set(chain.values())
    assert len(heads) == 1, f"expected one head, found {sorted(heads)}"
    assert all(parent is None or parent in chain for parent in chain.values())
