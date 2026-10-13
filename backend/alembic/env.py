"""Alembic environment.

The connection URL comes from the application settings, never from alembic.ini, so no credential is
stored in a tracked file. Only online mode is supported: the data migrations here validate live rows
before changing anything, which cannot be done by emitting offline SQL.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import get_settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_online() -> None:
    engine = create_engine(get_settings().database_url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            transaction_per_migration=True,  # each revision commits (or rolls back) on its own
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError(
        "Offline (--sql) mode is not supported: these migrations validate live data first. "
        "Run `alembic upgrade head` against the database."
    )
run_migrations_online()
