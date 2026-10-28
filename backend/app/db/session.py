from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

from app.core.config import get_settings

settings = get_settings()

_url = settings.database_url
_engine_kwargs: dict = {"pool_pre_ping": True}
if settings.is_sqlite:
    # Mirror app.core.database: StaticPool only for :memory:; NullPool for file SQLite.
    connect_args = {"check_same_thread": False}
    if ":memory:" in _url:
        _engine_kwargs = {"connect_args": connect_args, "poolclass": StaticPool}
    else:
        _engine_kwargs = {"connect_args": connect_args, "poolclass": NullPool}

engine = create_engine(_url, **_engine_kwargs)

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _sqlite_pragma(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
