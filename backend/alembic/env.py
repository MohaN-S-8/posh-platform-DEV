import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import Base
from app.models.analytics import AnalyticsSummary  # noqa: F401
from app.models.auth import (  # noqa: F401
    AccountLockout,
    LoginAttempts,
    OTPVerification,
    PasswordResetTokens,
    RefreshTokens,
)
from app.models.certificate import Certificate, CertificateTemplate  # noqa: F401
from app.models.company import CompanyMaster  # noqa: F401
from app.models.hr import EmployeeUploadBatch  # noqa: F401
from app.models.language import LanguageMaster  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.role import RoleMaster  # noqa: F401
from app.models.training import (  # noqa: F401
    AssessmentOption,
    AssessmentQuestion,
    AssessmentResult,
    CourseAssignment,
    TrainingHistory,
)
from app.models.user import UserMaster  # noqa: F401
from app.models.video import VideoCategory, VideoLanguage, VideoMaster

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_sync_database_url() -> str:
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    return url.replace("mysql+asyncmy://", "mysql+pymysql://").replace(
        "mysql+aiomysql://", "mysql+pymysql://"
    )


def run_migrations_offline() -> None:
    url = get_sync_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    config.set_main_option("sqlalchemy.url", get_sync_database_url())
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
