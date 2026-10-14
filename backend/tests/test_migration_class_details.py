"""Alembic revision 0004: capacity / room / class teacher on sections, class_is_active, and classes
unique per (campus, academic year, name).

Same approach as the 0002 and 0003 tests: a throwaway database on the configured PostgreSQL server
(``TEST_PG_URL``, else ``DATABASE_URL`` from ``backend/.env``), dropped afterwards, never the
development database. Skipped (and reported as skipped) if no PostgreSQL server is reachable.
"""

import importlib.util
import os
import uuid
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

BACKEND = Path(__file__).resolve().parents[1]
MIGRATION_FILE = BACKEND / "alembic" / "versions" / "0004_class_details_fields.py"

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("OTP_DEBUG", "true")
os.environ.setdefault("JWT_SECRET", "test-secret-qmis-erp-phase0-local")

from app.models import Base  # noqa: E402
from app.services import schema_check  # noqa: E402
from app.services.seed import seed_reference_data  # noqa: E402


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_0004", MIGRATION_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = _load_migration()


def test_migration_is_a_no_op_on_non_postgres_databases():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        assert migration.upgrade_connection(connection)["columns_added"] == []
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


_TO_0003 = (
    "DELETE FROM sections",
    "DELETE FROM school_classes",
    "ALTER TABLE sections DROP CONSTRAINT IF EXISTS ck_sections_capacity_positive",
    "DROP INDEX IF EXISTS ix_sections_class_teacher_user_id",
    "ALTER TABLE sections DROP COLUMN IF EXISTS class_teacher_user_id",
    "ALTER TABLE sections DROP COLUMN IF EXISTS room_number",
    "ALTER TABLE sections DROP COLUMN IF EXISTS capacity",
    "ALTER TABLE school_classes DROP COLUMN IF EXISTS is_active",
    "ALTER TABLE school_classes DROP CONSTRAINT IF EXISTS uq_school_class_campus_year_name",
    "ALTER TABLE school_classes ALTER COLUMN academic_year_id DROP NOT NULL",
    "ALTER TABLE school_classes DROP CONSTRAINT IF EXISTS school_classes_campus_id_name_key",
    "ALTER TABLE school_classes ADD CONSTRAINT school_classes_campus_id_name_key UNIQUE (campus_id, name)",
)


@pytest.fixture()
def at_0003(pg):
    """The database exactly as revision 0003 leaves it: no new columns, year may be empty, name unique per campus."""
    with pg.begin() as connection:
        for statement in _TO_0003:
            connection.execute(text(statement))
    return pg


def _campus_with_years(pg, years: int):
    """A fresh campus with that many academic years. Returns (campus_id, [year_ids])."""
    campus_id = uuid.uuid4()
    year_ids = [uuid.uuid4() for _ in range(years)]
    with pg.begin() as connection:
        connection.execute(
            text("INSERT INTO campuses (id, code, name, city, created_at) VALUES (:i, :c, 'Test', 'Town', now())"),
            {"i": campus_id, "c": f"M{uuid.uuid4().hex[:8]}"},
        )
        for index, year_id in enumerate(year_ids):
            connection.execute(
                text(
                    "INSERT INTO academic_years (id, campus_id, name, is_current, is_active, created_at) "
                    "VALUES (:i, :c, :n, :cur, true, now())"
                ),
                {"i": year_id, "c": campus_id, "n": f"20{30 + index}-{31 + index}", "cur": index == 0},
            )
    return campus_id, year_ids


def _add_class(pg, campus_id, name, year_id=None, with_section=True):
    class_id = uuid.uuid4()
    with pg.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO school_classes (id, campus_id, academic_year_id, name, created_at) "
                "VALUES (:i, :c, :y, :n, now())"
            ),
            {"i": class_id, "c": campus_id, "y": year_id, "n": name},
        )
        if with_section:
            connection.execute(
                text(
                    "INSERT INTO sections (id, campus_id, class_id, name, is_active, created_at) "
                    "VALUES (:i, :c, :k, 'A', true, now())"
                ),
                {"i": uuid.uuid4(), "c": campus_id, "k": class_id},
            )
    return class_id


def _columns(pg, table):
    with pg.connect() as connection:
        return {
            row[0]: row[1]
            for row in connection.execute(
                text(
                    "SELECT column_name, is_nullable FROM information_schema.columns "
                    "WHERE table_schema = current_schema() AND table_name = :t"
                ),
                {"t": table},
            )
        }


def _constraints(pg, table):
    with pg.connect() as connection:
        return {
            row[0]
            for row in connection.execute(
                text("SELECT conname FROM pg_constraint WHERE conrelid = CAST(:t AS regclass)"), {"t": table}
            )
        }


def _upgrade(pg):
    with pg.begin() as connection:
        return migration.upgrade_connection(connection)


def _downgrade(pg):
    with pg.begin() as connection:
        return migration.downgrade_connection(connection)


NEW_SECTION_COLUMNS = {"capacity", "room_number", "class_teacher_user_id"}


def test_upgrade_adds_the_columns_and_rules_and_keeps_every_class_and_section(at_0003):
    pg = at_0003
    campus, (year,) = _campus_with_years(pg, 1)
    first = _add_class(pg, campus, "Grade 1", year)
    second = _add_class(pg, campus, "Grade 2", year)
    with pg.connect() as c:
        before = c.execute(text("SELECT id, name, academic_year_id FROM school_classes ORDER BY name")).all()
        sections_before = c.execute(text("SELECT count(*) FROM sections")).scalar()

    result = _upgrade(pg)

    assert set(result["columns_added"]) == {f"sections.{c}" for c in NEW_SECTION_COLUMNS} | {"school_classes.is_active"}
    assert result["unique_replaced"] is True and result["year_backfilled"] == 0
    assert NEW_SECTION_COLUMNS <= set(_columns(pg, "sections"))
    assert _columns(pg, "school_classes")["academic_year_id"] == "NO"
    names = _constraints(pg, "school_classes")
    assert "uq_school_class_campus_year_name" in names and "school_classes_campus_id_name_key" not in names
    assert "ck_sections_capacity_positive" in _constraints(pg, "sections")
    with pg.connect() as c:
        assert c.execute(text("SELECT id, name, academic_year_id FROM school_classes ORDER BY name")).all() == before
        assert c.execute(text("SELECT count(*) FROM sections")).scalar() == sections_before
        assert c.execute(text("SELECT bool_and(is_active) FROM school_classes")).scalar() is True
    assert {first, second} == {row[0] for row in before}


def test_a_class_without_a_year_gets_the_campus_only_year_and_nothing_else_changes(at_0003):
    pg = at_0003
    campus, (only_year,) = _campus_with_years(pg, 1)
    orphan = _add_class(pg, campus, "Grade 1", None)
    dated = _add_class(pg, campus, "Grade 2", only_year)

    result = _upgrade(pg)

    assert result["year_backfilled"] == 1 and result["year_set_not_null"] is True
    with pg.connect() as c:
        rows = dict(c.execute(text("SELECT id, academic_year_id FROM school_classes")).all())
    assert rows[orphan] == only_year and rows[dated] == only_year


def test_a_class_without_a_year_in_a_campus_with_several_years_aborts_and_changes_nothing(at_0003):
    pg = at_0003
    campus, _ = _campus_with_years(pg, 2)
    _add_class(pg, campus, "Mystery Class", None)

    with pytest.raises(migration.MigrationAborted) as aborted:
        _upgrade(pg)

    assert "Mystery Class" in str(aborted.value) and "2 years" in str(aborted.value)
    assert NEW_SECTION_COLUMNS.isdisjoint(_columns(pg, "sections"))  # the transaction rolled back
    assert _columns(pg, "school_classes")["academic_year_id"] == "YES"
    assert "school_classes_campus_id_name_key" in _constraints(pg, "school_classes")


def test_running_it_twice_changes_nothing_the_second_time(at_0003):
    pg = at_0003
    campus, (year,) = _campus_with_years(pg, 1)
    _add_class(pg, campus, "Grade 1", year)
    _upgrade(pg)
    again = _upgrade(pg)
    assert again["columns_added"] == [] and again["unique_replaced"] is False
    assert again["year_backfilled"] == 0 and again["year_set_not_null"] is False


def test_after_upgrade_the_database_enforces_the_new_rules(at_0003):
    pg = at_0003
    campus, (this_year, next_year) = _campus_with_years(pg, 2)
    _upgrade(pg)

    _add_class(pg, campus, "Grade 1", this_year)
    _add_class(pg, campus, "Grade 1", next_year)  # same name, another year: allowed
    with pytest.raises(IntegrityError):
        _add_class(pg, campus, "Grade 1", this_year)  # same name, same year: refused
    with pytest.raises(IntegrityError):
        _add_class(pg, campus, "No Year", None)  # a year is required

    with pg.connect() as c:
        class_id = c.execute(text("SELECT id FROM school_classes LIMIT 1")).scalar()
    with pytest.raises(IntegrityError):
        with pg.begin() as c:
            c.execute(
                text(
                    "INSERT INTO sections (id, campus_id, class_id, name, capacity, is_active, created_at) "
                    "VALUES (:i, :c, :k, 'Z', 0, true, now())"
                ),
                {"i": uuid.uuid4(), "c": campus, "k": class_id},
            )
    with pytest.raises(IntegrityError):
        with pg.begin() as c:
            c.execute(
                text(
                    "INSERT INTO sections (id, campus_id, class_id, name, class_teacher_user_id, is_active, created_at) "
                    "VALUES (:i, :c, :k, 'Y', :u, true, now())"
                ),
                {"i": uuid.uuid4(), "c": campus, "k": class_id, "u": uuid.uuid4()},  # not a real login
            )


def test_downgrade_restores_the_0003_shape_when_nothing_would_be_lost(at_0003):
    pg = at_0003
    campus, (year,) = _campus_with_years(pg, 1)
    _add_class(pg, campus, "Grade 1", year)
    _upgrade(pg)

    assert _downgrade(pg)["reverted"] is True

    assert NEW_SECTION_COLUMNS.isdisjoint(_columns(pg, "sections"))
    assert "is_active" not in _columns(pg, "school_classes")
    assert _columns(pg, "school_classes")["academic_year_id"] == "YES"
    names = _constraints(pg, "school_classes")
    assert "school_classes_campus_id_name_key" in names and "uq_school_class_campus_year_name" not in names
    with pg.connect() as c:
        assert c.execute(text("SELECT count(*) FROM school_classes")).scalar() == 1  # the class survived


def test_downgrade_then_upgrade_round_trips(at_0003):
    pg = at_0003
    campus, (year,) = _campus_with_years(pg, 1)
    _add_class(pg, campus, "Grade 1", year)
    _upgrade(pg)
    _downgrade(pg)
    again = _upgrade(pg)
    assert set(again["columns_added"]) == {f"sections.{c}" for c in NEW_SECTION_COLUMNS} | {"school_classes.is_active"}
    with pg.connect() as c:
        assert c.execute(text("SELECT count(*) FROM school_classes")).scalar() == 1


@pytest.mark.parametrize(
    "setup,expected",
    [
        ("UPDATE sections SET capacity = 40", "capacity, room or class teacher"),
        ("UPDATE sections SET room_number = '101'", "capacity, room or class teacher"),
        ("UPDATE school_classes SET is_active = false", "deactivated class"),
    ],
)
def test_downgrade_refuses_to_discard_data_and_changes_nothing(at_0003, setup, expected):
    pg = at_0003
    campus, (year,) = _campus_with_years(pg, 1)
    _add_class(pg, campus, "Grade 1", year)
    _upgrade(pg)
    with pg.begin() as c:
        c.execute(text(setup))

    with pytest.raises(migration.MigrationAborted) as refused:
        _downgrade(pg)

    assert expected in str(refused.value) and "Downgrade refused" in str(refused.value)
    assert NEW_SECTION_COLUMNS <= set(_columns(pg, "sections"))  # still the 0004 shape
    assert "uq_school_class_campus_year_name" in _constraints(pg, "school_classes")


def test_downgrade_refuses_when_one_class_name_exists_in_two_years(at_0003):
    pg = at_0003
    campus, (this_year, next_year) = _campus_with_years(pg, 2)
    _upgrade(pg)
    _add_class(pg, campus, "Grade 1", this_year)
    _add_class(pg, campus, "Grade 1", next_year)

    with pytest.raises(migration.MigrationAborted) as refused:
        _downgrade(pg)

    assert "more than one academic year" in str(refused.value) and "Grade 1" in str(refused.value)
    assert "uq_school_class_campus_year_name" in _constraints(pg, "school_classes")


def test_schema_check_reports_a_database_that_has_not_run_0004_and_is_quiet_afterwards(at_0003, monkeypatch):
    pg = at_0003
    monkeypatch.setattr(schema_check, "engine", pg)

    behind = schema_check.pending_schema_problems()
    joined = " ".join(behind)
    assert "sections.capacity" in joined and "school_classes.is_active" in joined
    assert all("alembic upgrade head" in problem for problem in behind)

    _upgrade(pg)
    assert schema_check.pending_schema_problems() == []
