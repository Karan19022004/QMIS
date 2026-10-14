"""Alembic revision 0002: hr_employees.user_id VARCHAR(36) -> UUID (+ foreign key to users.id).

The conversion only means something on PostgreSQL, so these tests build a throwaway database on the
configured PostgreSQL server (``TEST_PG_URL``, else ``DATABASE_URL`` from ``backend/.env``) and drop
it afterwards. They never touch the real development database. If no PostgreSQL server is reachable
the PostgreSQL tests are SKIPPED (reported as skipped, not passed). The wiring tests need no database.
"""

import importlib.util
import os
import uuid
from pathlib import Path

import pytest
import sqlalchemy as sa
from dotenv import dotenv_values
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import sessionmaker

BACKEND = Path(__file__).resolve().parents[1]
MIGRATION_FILE = BACKEND / "alembic" / "versions" / "0002_hr_employees_user_id_uuid.py"

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("OTP_DEBUG", "true")
os.environ.setdefault("JWT_SECRET", "test-secret-qmis-erp-phase0-local")

from app.models import Base, HrEmployee, User  # noqa: E402
from app.services import hr_migrate, schema_check  # noqa: E402
from app.services.seed import seed_reference_data  # noqa: E402


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_0002", MIGRATION_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = _load_migration()


# --- wiring (no database needed) --------------------------------------------------------


def test_revisions_form_one_chain():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    script = ScriptDirectory.from_config(config)
    assert len(script.get_heads()) == 1  # one unbroken chain; later revisions extend it (see test_migration_new_tables)
    assert script.get_revision("0006_announcements").down_revision == "0005_document_records"
    assert script.get_revision("0005_document_records").down_revision == "0004_class_details_fields"
    assert script.get_revision("0004_class_details_fields").down_revision == "0003_class_year_uuid"
    assert script.get_revision("0003_class_year_uuid").down_revision == "0002_hr_user_id_uuid"
    assert script.get_revision("0002_hr_user_id_uuid").down_revision == "0001_baseline"
    assert script.get_revision("0001_baseline").down_revision is None


def test_alembic_config_stores_no_credentials():
    ini = (BACKEND / "alembic.ini").read_text(encoding="utf-8").lower()
    assert "sqlalchemy.url" not in ini and "password" not in ini and "postgresql" not in ini
    env = (BACKEND / "alembic" / "env.py").read_text(encoding="utf-8")
    assert "get_settings().database_url" in env  # the URL comes from the application settings


def test_migration_is_a_no_op_on_non_postgres_databases():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        assert migration.upgrade_connection(connection)["converted"] is False
        assert migration.downgrade_connection(connection)["reverted"] is False


# --- PostgreSQL scratch database -------------------------------------------------------


def _pg_url() -> str | None:
    explicit = os.environ.get("TEST_PG_URL")
    if explicit:
        return explicit
    url = dotenv_values(BACKEND / ".env").get("DATABASE_URL")
    return url if url and url.startswith("postgresql") else None


@pytest.fixture(scope="module")
def pg():
    url = _pg_url()
    if not url:
        pytest.skip("no PostgreSQL URL configured (TEST_PG_URL or DATABASE_URL in backend/.env)")
    base = make_url(url)
    name = f"qmis_test_mig_{uuid.uuid4().hex[:10]}"
    try:
        admin = create_engine(base.set(database="postgres"), isolation_level="AUTOCOMMIT")
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
    except Exception as error:  # server not running / not allowed
        pytest.skip(f"PostgreSQL not reachable for the migration tests: {type(error).__name__}")
    engine = create_engine(base.set(database=name))
    try:
        Base.metadata.create_all(engine)
        with sessionmaker(bind=engine)() as db:
            seed_reference_data(db)
        yield engine
    finally:
        engine.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture()
def old_shape(pg):
    """Put hr_employees back into the old shape (VARCHAR(36), no foreign key) with no rows."""
    with pg.begin() as connection:
        connection.execute(text("DELETE FROM hr_employees"))
        connection.execute(text("ALTER TABLE hr_employees DROP CONSTRAINT IF EXISTS hr_employees_user_id_fkey"))
        connection.execute(text("ALTER TABLE hr_employees ALTER COLUMN user_id TYPE varchar(36) USING user_id::text"))
    return pg


def _users(pg, count=2):
    with sessionmaker(bind=pg)() as db:
        return [(str(u.id), u.email) for u in db.scalars(select(User).limit(count)).all()]


def _campus(pg):
    with pg.connect() as connection:
        return connection.execute(text("SELECT id FROM campuses LIMIT 1")).scalar()


def _add_employee(pg, code, user_id):
    with pg.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO hr_employees (id, campus_id, employee_code, first_name, last_name, email, user_id, created_at) "
                "VALUES (:id, :campus, :code, 'T', 'E', :email, :uid, now())"
            ),
            {"id": uuid.uuid4(), "campus": _campus(pg), "code": code, "email": f"{code.lower()}@example.test", "uid": user_id},
        )


def _column_type(pg):
    with pg.connect() as connection:
        return migration._column_type(connection)


def _has_fk(pg):
    with pg.connect() as connection:
        return migration._has_user_fk(connection)


def _links(pg):
    with pg.connect() as connection:
        return dict(connection.execute(text("SELECT employee_code, user_id::text FROM hr_employees")).all())


def _run_upgrade(pg):
    with pg.begin() as connection:
        return migration.upgrade_connection(connection)


def test_converts_keeps_every_row_and_link_and_adds_the_foreign_key(old_shape):
    (u1, _), (u2, _) = _users(old_shape)
    _add_employee(old_shape, "MIG-1", u1)
    _add_employee(old_shape, "MIG-2", None)
    _add_employee(old_shape, "MIG-3", u2)
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)

    result = _run_upgrade(old_shape)

    assert result["converted"] and result["foreign_key_added"]
    assert (result["rows"], result["links"], result["blank_to_null"]) == (3, 2, 0)
    assert _column_type(old_shape) == "uuid" and _has_fk(old_shape)
    assert _links(old_shape) == {"MIG-1": u1, "MIG-2": None, "MIG-3": u2}


def test_blank_becomes_null_and_uppercase_is_the_same_uuid(old_shape):
    (u1, _), (u2, _) = _users(old_shape)
    _add_employee(old_shape, "MIG-1", u1.upper())
    _add_employee(old_shape, "MIG-2", "   ")
    _add_employee(old_shape, "MIG-3", u2)
    result = _run_upgrade(old_shape)
    assert result["blank_to_null"] == 1 and result["links"] == 2
    assert _links(old_shape) == {"MIG-1": u1, "MIG-2": None, "MIG-3": u2}


def test_a_value_that_is_not_a_uuid_aborts_and_nothing_changes(old_shape):
    (u1, _), _ = _users(old_shape)
    _add_employee(old_shape, "MIG-1", u1)
    _add_employee(old_shape, "MIG-2", "not-a-uuid")
    with pytest.raises(migration.MigrationAborted, match="MIG-2"):
        _run_upgrade(old_shape)
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)
    assert _links(old_shape) == {"MIG-1": u1, "MIG-2": "not-a-uuid"}  # the bad value is kept, not discarded


def test_a_link_to_a_login_that_does_not_exist_aborts_and_nothing_changes(old_shape):
    ghost = str(uuid.uuid4())
    _add_employee(old_shape, "MIG-1", ghost)
    with pytest.raises(migration.MigrationAborted, match="MIG-1"):
        _run_upgrade(old_shape)
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)
    assert _links(old_shape) == {"MIG-1": ghost}


def test_running_it_twice_changes_nothing_the_second_time(old_shape):
    (u1, _), _ = _users(old_shape)
    _add_employee(old_shape, "MIG-1", u1)
    _run_upgrade(old_shape)
    second = _run_upgrade(old_shape)
    assert not second["converted"] and not second["foreign_key_added"]
    assert _links(old_shape) == {"MIG-1": u1}


def test_a_uuid_column_without_the_foreign_key_gets_it(old_shape):
    (u1, _), _ = _users(old_shape)
    _add_employee(old_shape, "MIG-1", u1)
    with old_shape.begin() as connection:
        connection.execute(text("ALTER TABLE hr_employees ALTER COLUMN user_id TYPE uuid USING user_id::uuid"))
    result = _run_upgrade(old_shape)
    assert not result["converted"] and result["foreign_key_added"] and _has_fk(old_shape)


def test_downgrade_restores_the_old_shape_and_keeps_the_links(old_shape):
    (u1, _), _ = _users(old_shape)
    _add_employee(old_shape, "MIG-1", u1)
    _add_employee(old_shape, "MIG-2", None)
    _run_upgrade(old_shape)
    with old_shape.begin() as connection:
        assert migration.downgrade_connection(connection)["reverted"]
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)
    assert _links(old_shape) == {"MIG-1": u1, "MIG-2": None}


def test_the_original_failing_query_fails_before_and_works_after(old_shape):
    """Negative control for the real defect: `user_id == <uuid>` (what HR 'own record' runs)."""
    (u1, _), _ = _users(old_shape)
    _add_employee(old_shape, "MIG-1", u1)
    wanted = uuid.UUID(u1)
    with sessionmaker(bind=old_shape)() as db:
        with pytest.raises(ProgrammingError, match="character varying = uuid"):
            db.scalar(select(HrEmployee).where(HrEmployee.user_id == wanted))
    _run_upgrade(old_shape)
    with sessionmaker(bind=old_shape)() as db:
        found = db.scalar(select(HrEmployee).where(HrEmployee.user_id == wanted))
        assert found is not None and found.employee_code == "MIG-1"


def test_the_startup_helper_no_longer_adds_user_id_as_varchar(old_shape, monkeypatch):
    with old_shape.begin() as connection:
        connection.execute(text("ALTER TABLE hr_employees DROP COLUMN user_id"))  # a starter table without it
    monkeypatch.setattr(hr_migrate, "engine", old_shape)
    hr_migrate.ensure_hr_employee_columns()
    assert _column_type(old_shape) == "uuid"


def test_schema_check_reports_the_old_shape_and_is_quiet_when_current(old_shape, monkeypatch):
    monkeypatch.setattr(schema_check, "engine", old_shape)
    problems = schema_check.pending_schema_problems()
    assert len(problems) == 1 and "alembic upgrade head" in problems[0]
    _run_upgrade(old_shape)
    assert schema_check.pending_schema_problems() == []
