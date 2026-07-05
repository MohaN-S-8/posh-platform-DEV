from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.admin import router as admin_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.assessments import router as assessments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.certificates import router as certificates_router
from app.api.v1.company import router as company_router
from app.api.v1.employee import router as employee_router
from app.api.v1.hr import router as hr_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.users import router as users_router
from app.api.v1.videos import router as videos_router
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="POSH Training Platform API", version="1.0.0", docs_url="/docs")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(company_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(videos_router, prefix="/api/v1")
app.include_router(assessments_router, prefix="/api/v1")
app.include_router(hr_router, prefix="/api/v1")
app.include_router(certificates_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(employee_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")


@app.on_event("startup")
async def run_seed_on_startup():
    """
    Ensure required reference data and default login users exist.
    This is intentionally idempotent so Docker restarts can repair missing seed rows.
    """
    from sqlalchemy import text

    from app.core.security import hash_password
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS permission_master (
                    permission_id INT AUTO_INCREMENT PRIMARY KEY,
                    permission_key VARCHAR(100) UNIQUE NOT NULL,
                    permission_name VARCHAR(150) NOT NULL,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS role_permission (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    role_id INT NOT NULL,
                    permission_id INT NOT NULL,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_role_permission (role_id, permission_id)
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS company_languages (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    language_id INT NOT NULL,
                    is_default BOOLEAN DEFAULT FALSE,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_company_language (company_id, language_id)
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NULL,
                    company_id INT NULL,
                    action VARCHAR(120) NOT NULL,
                    table_name VARCHAR(120) NULL,
                    record_id VARCHAR(100) NULL,
                    ip_address VARCHAR(45) NULL,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS video_quality (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    video_id INT NOT NULL,
                    company_id INT NOT NULL,
                    quality_label VARCHAR(20) NOT NULL,
                    video_path VARCHAR(500) NOT NULL,
                    mime_type VARCHAR(100),
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_video_quality (video_id, quality_label)
                )
                """
            )
        )

        await db.execute(
            text(
                """
                INSERT INTO role_master (role_id, role_name)
                VALUES
                    (1, 'Super Admin'),
                    (2, 'Company Admin'),
                    (3, 'HR'),
                    (4, 'Employee')
                ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)
                """
            )
        )

        await db.execute(
            text(
                """
                INSERT INTO company_master
                    (company_id, company_code, company_name, status, is_deleted)
                VALUES
                    (1, 'DEFAULT', 'POSH Platform', 'Active', 'N')
                ON DUPLICATE KEY UPDATE
                    company_code = VALUES(company_code),
                    company_name = VALUES(company_name),
                    status = 'Active',
                    is_deleted = 'N'
                """
            )
        )

        await db.execute(
            text(
                """
                INSERT INTO language_master (language_id, language_name)
                VALUES
                    (1, 'English'),
                    (2, 'Hindi'),
                    (3, 'Tamil'),
                    (4, 'Telugu'),
                    (5, 'Malayalam'),
                    (6, 'Kannada')
                ON DUPLICATE KEY UPDATE language_name = VALUES(language_name)
                """
            )
        )

        await db.execute(
            text(
                """
                INSERT INTO video_category (category_id, category_name)
                VALUES
                    (1, 'POSH Awareness'),
                    (2, 'Workplace Conduct'),
                    (3, 'Case Studies'),
                    (4, 'Reporting Procedures'),
                    (5, 'Annual Refresher')
                ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)
                """
            )
        )

        default_password_hash = hash_password("Admin@1234")
        default_users = [
            {
                "employee_id": "ADMIN001",
                "first_name": "Super",
                "last_name": "Admin",
                "email": "admin@posh.com",
                "mobile": "9000000001",
                "role_id": 1,
            },
            {
                "employee_id": "HR001",
                "first_name": "HR",
                "last_name": "Manager",
                "email": "hr@posh.com",
                "mobile": "9000000002",
                "role_id": 3,
            },
        ]

        for user in default_users:
            params = {**user, "pwd": default_password_hash}
            await db.execute(
                text(
                    """
                    UPDATE user_master
                    SET
                        company_id = 1,
                        employee_id = :employee_id,
                        first_name = :first_name,
                        last_name = :last_name,
                        email = :email,
                        mobile = :mobile,
                        role_id = :role_id,
                        username = :email,
                        password_hash = :pwd,
                        status = 'Active',
                        is_deleted = 'N'
                    WHERE
                        email = :email
                        OR username = :email
                        OR employee_id = :employee_id
                    """
                ),
                params,
            )
            await db.execute(
                text(
                    """
                    INSERT INTO user_master
                        (company_id, employee_id, first_name, last_name,
                         email, mobile, role_id, username, password_hash, status, is_deleted)
                    SELECT
                        1, :employee_id, :first_name, :last_name,
                        :email, :mobile, :role_id, :email, :pwd, 'Active', 'N'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM user_master WHERE email = :email
                    )
                    """
                ),
                params,
            )

        await db.execute(
            text(
                """
                UPDATE account_lockout
                SET failed_attempts = 0, locked_until = NULL
                WHERE user_id IN (
                    SELECT user_id
                    FROM user_master
                    WHERE email IN ('admin@posh.com', 'hr@posh.com')
                )
                """
            )
        )
        await db.execute(
            text(
                """
                INSERT INTO permission_master (permission_key, permission_name)
                VALUES
                    ('users.manage', 'Manage Users'),
                    ('videos.manage', 'Manage Videos'),
                    ('certificates.manage', 'Manage Certificates'),
                    ('reports.view', 'View Reports'),
                    ('training.assign', 'Assign Training'),
                    ('courses.watch', 'Watch Courses')
                ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name)
                """
            )
        )
        await db.execute(
            text(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT 1, permission_id FROM permission_master
                UNION SELECT 2, permission_id FROM permission_master
                WHERE permission_key IN ('users.manage','videos.manage','certificates.manage','reports.view','training.assign')
                UNION SELECT 3, permission_id FROM permission_master
                WHERE permission_key IN ('reports.view','training.assign')
                UNION SELECT 4, permission_id FROM permission_master
                WHERE permission_key IN ('courses.watch')
                """
            )
        )
        await db.execute(
            text(
                """
                INSERT IGNORE INTO company_languages (company_id, language_id, is_default)
                VALUES
                    (1, 1, TRUE),
                    (1, 2, FALSE),
                    (1, 3, FALSE),
                    (1, 4, FALSE),
                    (1, 5, FALSE),
                    (1, 6, FALSE)
                """
            )
        )

        await db.commit()
        print("Auto-seed complete: roles, default company, admin, and HR users are ready.")


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": "POSH Training Platform"}


@app.get("/")
async def root():
    return {"message": "POSH Platform API. Visit /docs for documentation."}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


app.add_middleware(SecurityHeadersMiddleware)
