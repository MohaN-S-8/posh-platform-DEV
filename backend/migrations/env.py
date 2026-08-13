import os
from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context
from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ✅ FORCE SYNC DRIVER
def get_sync_database_url() -> str:
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    return url.replace("mysql+asyncmy://", "mysql+pymysql://").replace(
        "mysql+aiomysql://", "mysql+pymysql://"
    )


def run_migrations_offline():
    url = get_sync_database_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    config.set_main_option("sqlalchemy.url", get_sync_database_url())
    connectable = create_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
