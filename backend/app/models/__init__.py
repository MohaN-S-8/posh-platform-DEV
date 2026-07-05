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
