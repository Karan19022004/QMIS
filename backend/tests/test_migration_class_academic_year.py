"""Alembic revision 0003: school_classes.academic_year_id VARCHAR(36) -> UUID (+ foreign key).

Same approach as test_migration_hr_user_id.py: a throwaway database on the configured PostgreSQL
server (``TEST_PG_URL``, else ``DATABASE_URL`` from ``backend/.env``), dropped afterwards, never the
development database. Skipped (and reported as skipped) if no PostgreSQL server is reachable.
"""

import importlib.util
import os
import uuid
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import sessionmaker

BACKEND = Path(__file__).resolve().parents[1]
MIGRATION_FILE = BACKEND / "alembic" / "versions" / "0003_school_classes_academic_year_uuid.py"

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("OTP_DEBUG", "true")
os.environ.setdefault("JWT_SECRET", "test-secret-qmis-erp-phase0-local")

from app.models import AcademicYear, Base, SchoolClass  # noqa: E402
from app.services import masters_migrate, schema_check  # noqa: E402
from app.services.seed import seed_reference_data  # noqa: E402


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_0003", MIGRATION_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = _load_migration()


def test_migration_is_a_no_op_on_non_postgres_databases():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        assert migration.upgrade_connection(connection)["converted"] is False
        assert migration.downgrade_connection(connection)["reverted"] is False


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
    except Exception as error:
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
    """school_classes back in the old shape (VARCHAR(36), no foreign key), with no classes."""
    with pg.begin() as connection:
        connection.execute(text("DELETE FROM sections"))
        connection.execute(text("DELETE FROM school_classes"))
        connection.execute(text("ALTER TABLE school_classes DROP CONSTRAINT IF EXISTS school_classes_academic_year_id_fkey"))
        connection.execute(text("ALTER TABLE school_classes ALTER COLUMN academic_year_id TYPE varchar(36) USING academic_year_id::text"))
    return pg


def _campus(pg):
    with pg.connect() as connection:
        return connection.execute(text("SELECT id FROM campuses ORDER BY created_at LIMIT 1")).scalar()


def _other_campus(pg):
    with pg.begin() as connection:
        code = f"X{uuid.uuid4().hex[:8]}"
        new_id = uuid.uuid4()
        connection.execute(
            text("INSERT INTO campuses (id, code, name, city, created_at) VALUES (:i, :c, 'Other', 'Elsewhere', now())"),
            {"i": new_id, "c": code},
        )
        return new_id


def _year(pg, name, campus=None):
    year_id = uuid.uuid4()
    with pg.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO academic_years (id, campus_id, name, is_current, is_active, created_at) "
                "VALUES (:i, :c, :n, false, true, now())"
            ),
            {"i": year_id, "c": campus or _campus(pg), "n": f"{name}-{uuid.uuid4().hex[:4]}"},
        )
    return str(year_id)


def _add_class(pg, name, year_id, campus=None):
    class_id = uuid.uuid4()
    with pg.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO school_classes (id, campus_id, name, created_at, academic_year_id) "
                "VALUES (:i, :c, :n, now(), :y)"
            ),
            {"i": class_id, "c": campus or _campus(pg), "n": name, "y": year_id},
        )
    return class_id


def _add_section(pg, class_id, name="A"):
    with pg.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO sections (id, campus_id, class_id, name, is_active, created_at) "
                "VALUES (:i, :c, :k, :n, true, now())"
            ),
            {"i": uuid.uuid4(), "c": _campus(pg), "k": class_id, "n": name},
        )


def _column_type(pg):
    with pg.connect() as connection:
        return migration._column_type(connection)


def _has_fk(pg):
    with pg.connect() as connection:
        return migration._has_year_fk(connection)


def _links(pg):
    with pg.connect() as connection:
        return dict(connection.execute(text("SELECT name, academic_year_id::text FROM school_classes")).all())


def _run_upgrade(pg):
    with pg.begin() as connection:
        return migration.upgrade_connection(connection)


def test_converts_keeps_every_class_link_and_section_and_adds_the_foreign_key(old_shape):
    y1, y2 = _year(old_shape, "Y1"), _year(old_shape, "Y2")
    k1 = _add_class(old_shape, "C1", y1)
    _add_class(old_shape, "C2", None)
    _add_class(old_shape, "C3", y2)
    _add_section(old_shape, k1)
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)

    result = _run_upgrade(old_shape)

    assert result["converted"] and result["foreign_key_added"]
    assert (result["rows"], result["links"], result["blank_to_null"]) == (3, 2, 0)
    assert _column_type(old_shape) == "uuid" and _has_fk(old_shape)
    assert _links(old_shape) == {"C1": y1, "C2": None, "C3": y2}
    with old_shape.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM sections WHERE class_id = :k"), {"k": k1}).scalar() == 1


def test_blank_becomes_null_and_uppercase_is_the_same_uuid(old_shape):
    y1, y2 = _year(old_shape, "Y1"), _year(old_shape, "Y2")
    _add_class(old_shape, "C1", y1.upper())
    _add_class(old_shape, "C2", "   ")
    _add_class(old_shape, "C3", y2)
    result = _run_upgrade(old_shape)
    assert result["blank_to_null"] == 1 and result["links"] == 2
    assert _links(old_shape) == {"C1": y1, "C2": None, "C3": y2}


def test_a_value_that_is_not_a_uuid_aborts_and_nothing_changes(old_shape):
    y1 = _year(old_shape, "Y1")
    _add_class(old_shape, "C1", y1)
    _add_class(old_shape, "C2", "not-a-uuid")
    with pytest.raises(migration.MigrationAborted, match="C2"):
        _run_upgrade(old_shape)
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)
    assert _links(old_shape) == {"C1": y1, "C2": "not-a-uuid"}


def test_a_link_to_a_year_that_does_not_exist_aborts_and_nothing_changes(old_shape):
    ghost = str(uuid.uuid4())
    _add_class(old_shape, "C1", ghost)
    with pytest.raises(migration.MigrationAborted, match="does not exist"):
        _run_upgrade(old_shape)
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)
    assert _links(old_shape) == {"C1": ghost}


def test_a_link_to_a_year_on_another_campus_aborts_and_nothing_changes(old_shape):
    foreign_year = _year(old_shape, "Foreign", campus=_other_campus(old_shape))
    _add_class(old_shape, "C1", foreign_year)  # class on the first campus, year on another
    with pytest.raises(migration.MigrationAborted, match="different campus"):
        _run_upgrade(old_shape)
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)
    assert _links(old_shape) == {"C1": foreign_year}


def test_running_it_twice_changes_nothing_the_second_time(old_shape):
    y1 = _year(old_shape, "Y1")
    _add_class(old_shape, "C1", y1)
    _run_upgrade(old_shape)
    second = _run_upgrade(old_shape)
    assert not second["converted"] and not second["foreign_key_added"]
    assert _links(old_shape) == {"C1": y1}


def test_a_uuid_column_without_the_foreign_key_gets_it(old_shape):
    y1 = _year(old_shape, "Y1")
    _add_class(old_shape, "C1", y1)
    with old_shape.begin() as connection:
        connection.execute(text("ALTER TABLE school_classes ALTER COLUMN academic_year_id TYPE uuid USING academic_year_id::uuid"))
    result = _run_upgrade(old_shape)
    assert not result["converted"] and result["foreign_key_added"] and _has_fk(old_shape)


def test_downgrade_restores_the_old_shape_and_keeps_the_links(old_shape):
    y1 = _year(old_shape, "Y1")
    _add_class(old_shape, "C1", y1)
    _add_class(old_shape, "C2", None)
    _run_upgrade(old_shape)
    with old_shape.begin() as connection:
        assert migration.downgrade_connection(connection)["reverted"]
    assert _column_type(old_shape) == "character varying" and not _has_fk(old_shape)
    assert _links(old_shape) == {"C1": y1, "C2": None}


def test_the_original_failing_query_fails_before_and_works_after(old_shape):
    """Negative control for the real defect: GET /masters/classes?academic_year_id=<uuid>."""
    y1 = _year(old_shape, "Y1")
    _add_class(old_shape, "C1", y1)
    wanted = uuid.UUID(y1)
    with sessionmaker(bind=old_shape)() as db:
        with pytest.raises(ProgrammingError, match="character varying = uuid"):
            db.scalars(select(SchoolClass).where(SchoolClass.academic_year_id == wanted)).all()
    _run_upgrade(old_shape)
    with sessionmaker(bind=old_shape)() as db:
        found = db.scalars(select(SchoolClass).where(SchoolClass.academic_year_id == wanted)).all()
        assert [c.name for c in found] == ["C1"]


def test_after_migration_class_and_year_relate_and_the_database_enforces_it(old_shape):
    y1 = _year(old_shape, "Y1")
    k1 = _add_class(old_shape, "C1", y1)
    _run_upgrade(old_shape)
    with sessionmaker(bind=old_shape)() as db:
        rows = db.execute(
            select(SchoolClass.name, AcademicYear.id)
            .join(AcademicYear, AcademicYear.id == SchoolClass.academic_year_id)
            .where(SchoolClass.id == k1)
        ).all()
        assert rows == [("C1", uuid.UUID(y1))]
    with pytest.raises(IntegrityError):  # a class cannot point at a year that does not exist
        _add_class(old_shape, "C-bad", str(uuid.uuid4()))
    with pytest.raises(IntegrityError):  # a year that classes use cannot be hard-deleted
        with old_shape.begin() as connection:
            connection.execute(text("DELETE FROM academic_years WHERE id = :i"), {"i": y1})
    assert _links(old_shape) == {"C1": y1}


def test_the_startup_helper_no_longer_adds_the_column_as_varchar(old_shape, monkeypatch):
    with old_shape.begin() as connection:
        connection.execute(text("ALTER TABLE school_classes DROP COLUMN academic_year_id"))  # a starter table without it
    monkeypatch.setattr(masters_migrate, "engine", old_shape)
    masters_migrate.ensure_masters_schema()
    assert _column_type(old_shape) == "uuid"


def test_schema_check_reports_the_old_shape_and_is_quiet_when_current(old_shape, monkeypatch):
    monkeypatch.setattr(schema_check, "engine", old_shape)
    problems = schema_check.pending_schema_problems()
    assert len(problems) == 1 and "school_classes.academic_year_id" in problems[0] and "alembic upgrade head" in problems[0]
    _run_upgrade(old_shape)
    assert schema_check.pending_schema_problems() == []
