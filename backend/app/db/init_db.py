import asyncio

from sqlalchemy import text

from app.db.base import Base
from app.db.session import engine

# Import models so their tables are registered on Base.metadata.
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
from app.models.video import VideoCategory, VideoLanguage, VideoMaster  # noqa: F401


async def repair_legacy_schema(conn) -> None:
    """Repair tables created by older manual startup SQL before metadata.create_all()."""
    template_table_result = await conn.execute(
        text(
            """
            SELECT COUNT(*) AS table_count
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = 'certificate_template'
            """
        )
    )
    if template_table_result.scalar_one() == 0:
        return

    column_result = await conn.execute(
        text(
            """
            SELECT
                SUM(column_name = 'id') AS has_id,
                SUM(column_name = 'template_id') AS has_template_id
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'certificate_template'
              AND column_name IN ('id', 'template_id')
            """
        )
    )
    has_id, has_template_id = column_result.one()
    if has_id and not has_template_id:
        await conn.execute(
            text(
                """
                ALTER TABLE certificate_template
                CHANGE COLUMN id template_id INT AUTO_INCREMENT
                """
            )
        )


async def init_db() -> None:
    async with engine.begin() as conn:
        await repair_legacy_schema(conn)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
