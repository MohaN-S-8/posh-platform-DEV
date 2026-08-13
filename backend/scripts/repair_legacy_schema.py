import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401
from app.db.base import Base


def sync_database_url() -> str:
    return (
        os.environ["DATABASE_URL"]
        .replace("mysql+asyncmy://", "mysql+pymysql://")
        .replace("mysql+aiomysql://", "mysql+pymysql://")
    )


def column_sql(engine, column) -> str:
    column_type = column.type.compile(dialect=engine.dialect)
    default = ""
    if column.server_default is not None:
        default_arg = column.server_default.arg
        default = f" DEFAULT {default_arg}" if isinstance(default_arg, str) else ""
    return f"`{column.name}` {column_type} NULL{default}"


def existing_column_names(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def normalize_legacy_tables(engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "certificate_template" not in tables:
        return

    columns = existing_column_names(inspector, "certificate_template")
    with engine.begin() as connection:
        if "id" in columns and "template_id" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE `certificate_template` "
                    "CHANGE COLUMN `id` `template_id` INT NOT NULL AUTO_INCREMENT"
                )
            )
            print("Renamed certificate_template.id to certificate_template.template_id")
        if "certificate_name" in columns and "template_name" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE `certificate_template` "
                    "CHANGE COLUMN `certificate_name` `template_name` VARCHAR(100) NULL"
                )
            )
            print(
                "Renamed certificate_template.certificate_name "
                "to certificate_template.template_name"
            )


def add_missing_model_columns(engine) -> None:
    inspector = inspect(engine)
    db_tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if table.name not in db_tables:
                continue

            existing_columns = existing_column_names(inspector, table.name)
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                connection.execute(
                    text(f"ALTER TABLE `{table.name}` ADD COLUMN {column_sql(engine, column)}")
                )
                print(f"Added missing column {table.name}.{column.name}")


def main() -> int:
    engine = create_engine(sync_database_url())
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if not tables or "company_master" not in tables:
        print("Fresh database detected; Alembic will create schema.")
        engine.dispose()
        return 0

    legacy_schema = "posh_employee_master" in tables or "certificate_template" in tables
    if not legacy_schema:
        print("Alembic-managed database detected.")
        engine.dispose()
        return 0

    print("Legacy schema detected; repairing missing model tables and columns.")
    normalize_legacy_tables(engine)
    add_missing_model_columns(engine)
    Base.metadata.create_all(bind=engine)
    add_missing_model_columns(engine)

    engine.dispose()
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
