from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

from app.api.v1.admin import router as admin_router
from app.api.v1.admin_config import router as admin_config_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.annual_returns import router as annual_returns_router
from app.api.v1.assessments import router as assessments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.certificates import router as certificates_router
from app.api.v1.company import router as company_router
from app.api.v1.concerns import router as concerns_router
from app.api.v1.employee import router as employee_router
from app.api.v1.hr import router as hr_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.policy import router as policy_router
from app.api.v1.users import router as users_router
from app.api.v1.videos import router as videos_router
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="XYZ Portal API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

if settings.APP_ENV.lower() == "production":
    app.add_middleware(HTTPSRedirectMiddleware)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(company_router, prefix="/api/v1")
app.include_router(concerns_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(videos_router, prefix="/api/v1")
app.include_router(assessments_router, prefix="/api/v1")
app.include_router(hr_router, prefix="/api/v1")
app.include_router(certificates_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(annual_returns_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(admin_config_router, prefix="/api/v1")
app.include_router(employee_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(policy_router, prefix="/api/v1")


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
                CREATE TABLE IF NOT EXISTS company_master (
                    company_id INT PRIMARY KEY,
                    company_code VARCHAR(50),
                    company_name VARCHAR(255),
                    status VARCHAR(50),
                    is_deleted CHAR(1) DEFAULT 'N',
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS user_master (
                    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT,
                    employee_id VARCHAR(50),
                    first_name VARCHAR(100),
                    last_name VARCHAR(100),
                    email VARCHAR(100) UNIQUE,
                    mobile VARCHAR(20),
                    role_id INT,
                    username VARCHAR(100),
                    password_hash TEXT,
                    status VARCHAR(30),
                    is_deleted CHAR(1),
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS role_master (
                    role_id INT PRIMARY KEY,
                    role_name VARCHAR(100)
                )
            """
            )
        )
        await db.execute(
            text(
                """
        CREATE TABLE IF NOT EXISTS language_master (
        language_id INT PRIMARY KEY,
        language_name VARCHAR(100)
        )
        """
            )
        )
        await db.execute(
            text(
                """
        CREATE TABLE IF NOT EXISTS video_category (
            category_id INT PRIMARY KEY,
            category_name VARCHAR(150)
        )
        """
            )
        )
        await db.execute(
            text(
                """
        CREATE TABLE IF NOT EXISTS account_lockout (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT,
        failed_attempts INT DEFAULT 0,
        locked_until DATETIME NULL
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
                CREATE TABLE IF NOT EXISTS concerns (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    company_id INT NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    message TEXT NOT NULL,
                    status ENUM('Open', 'Reviewed', 'Closed') DEFAULT 'Open',
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX ix_concerns_company_created (company_id, created_date),
                    INDEX ix_concerns_user (user_id)
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS posh_policy (
                    policy_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NULL UNIQUE,
                    title VARCHAR(200),
                    overview TEXT,
                    version VARCHAR(50),
                    approved_date VARCHAR(50),
                    document_path VARCHAR(500) NULL,
                    document_name VARCHAR(255) NULL,
                    harassment_types_json TEXT,
                    committee_members_json TEXT,
                    rights_json TEXT,
                    faqs_json TEXT,
                    updated_by BIGINT NULL,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS posh_policy_acknowledgement (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    company_id INT NULL,
                    policy_id BIGINT NULL,
                    policy_version VARCHAR(50) NULL,
                    acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_policy_ack_user_version (user_id, policy_id, policy_version),
                    INDEX ix_policy_ack_user (user_id)
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS posh_master_codes (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    category VARCHAR(80) NOT NULL,
                    name VARCHAR(150) NOT NULL,
                    code VARCHAR(80) NOT NULL,
                    description VARCHAR(255) NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_posh_master_code (category, code)
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS posh_offices (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    office_name VARCHAR(150) NOT NULL UNIQUE,
                    office_address TEXT NOT NULL,
                    office_state VARCHAR(150) NULL,
                    office_city VARCHAR(150) NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS posh_role_access (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    role_label VARCHAR(100) NOT NULL,
                    access_item VARCHAR(150) NOT NULL,
                    access_status VARCHAR(80) DEFAULT 'Access enabled',
                    is_allowed BOOLEAN DEFAULT TRUE,
                    display_order INT DEFAULT 1,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_posh_role_access (role_label, access_item)
                )
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS posh_employee_master (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    employee_id VARCHAR(30) NOT NULL,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NULL,
                    email VARCHAR(100) NOT NULL,
                    mobile VARCHAR(20) NOT NULL,
                    date_of_birth DATE NULL,
                    father_name VARCHAR(150) NULL,
                    emergency_contact VARCHAR(20) NULL,
                    gender VARCHAR(20) NULL,
                    blood_group VARCHAR(10) NULL,
                    physically_challenged VARCHAR(10) NULL,
                    marital_status VARCHAR(20) NULL,
                    pan_number VARCHAR(20) NULL,
                    foreign_national VARCHAR(10) NULL,
                    joining_date DATE NULL,
                    designation VARCHAR(100) NULL,
                    department VARCHAR(100) NULL,
                    location_city VARCHAR(150) NULL,
                    employment_status VARCHAR(50) NULL,
                    employee_status VARCHAR(50) NULL,
                    resignation_date DATE NULL,
                    resignation_reason VARCHAR(255) NULL,
                    reporting_to VARCHAR(150) NULL,
                    branch_name VARCHAR(150) NULL,
                    branch_id VARCHAR(50) NULL,
                    transfer_date DATE NULL,
                    transfer_location VARCHAR(150) NULL,
                    transfer_branch_name VARCHAR(150) NULL,
                    transfer_branch_id VARCHAR(50) NULL,
                    ic_role VARCHAR(100) NULL,
                    status VARCHAR(30) DEFAULT 'Active',
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_posh_employee_master_company_emp (company_id, employee_id),
                    UNIQUE KEY uq_posh_employee_master_company_email (company_id, email)
                )
                """
            )
        )
        for column_name, column_sql in [
            ("document_path", "ADD COLUMN document_path VARCHAR(500) NULL"),
            ("document_name", "ADD COLUMN document_name VARCHAR(255) NULL"),
        ]:
            policy_column_result = await db.execute(
                text(
                    """
                    SELECT COUNT(*) AS column_count
                    FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = 'posh_policy'
                      AND column_name = :column_name
                    """
                ),
                {"column_name": column_name},
            )
            if policy_column_result.scalar_one() == 0:
                await db.execute(text(f"ALTER TABLE posh_policy {column_sql}"))
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
                CREATE TABLE IF NOT EXISTS certificate_template (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    certificate_name VARCHAR(255) NULL,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        template_column_result = await db.execute(
            text(
                """
                SELECT COUNT(*) AS column_count
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'certificate_template'
                  AND column_name = 'template_file_path'
                """
            )
        )
        if template_column_result.scalar_one() == 0:
            await db.execute(
                text(
                    """
                    ALTER TABLE certificate_template
                    ADD COLUMN template_file_path VARCHAR(255) NULL
                    """
                )
            )

        async def ensure_column(table_name: str, column_name: str, column_sql: str):
            table_result = await db.execute(
                text(
                    """
                    SELECT COUNT(*) AS table_count
                    FROM information_schema.tables
                    WHERE table_schema = DATABASE()
                      AND table_name = :table_name
                    """
                ),
                {"table_name": table_name},
            )
            if table_result.scalar_one() == 0:
                return
            column_result = await db.execute(
                text(
                    """
                    SELECT COUNT(*) AS column_count
                    FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = :table_name
                      AND column_name = :column_name
                    """
                ),
                {"table_name": table_name, "column_name": column_name},
            )
            if column_result.scalar_one() == 0:
                await db.execute(text(f"ALTER TABLE {table_name} {column_sql}"))

        for column_name, column_sql in [
            ("service_code", "ADD COLUMN service_code VARCHAR(50) NULL DEFAULT 'POSH'"),
            (
                "training_level",
                "ADD COLUMN training_level VARCHAR(50) NULL DEFAULT 'Basic'",
            ),
            (
                "target_audience",
                "ADD COLUMN target_audience VARCHAR(50) NULL DEFAULT 'Employee'",
            ),
        ]:
            await ensure_column("video_master", column_name, column_sql)
        await db.execute(
            text(
                """
                UPDATE video_master
                SET
                    service_code = COALESCE(service_code, 'POSH'),
                    training_level = COALESCE(training_level, 'Basic'),
                    target_audience = COALESCE(target_audience, 'Employee')
                """
            )
        )

        for column_name, column_sql in [
            ("incident_date", "ADD COLUMN incident_date VARCHAR(50) NULL"),
            ("evidence_note", "ADD COLUMN evidence_note VARCHAR(500) NULL"),
            ("stage", "ADD COLUMN stage INT NULL DEFAULT 1"),
            ("notice_date", "ADD COLUMN notice_date VARCHAR(50) NULL"),
            ("enquiry_sessions_json", "ADD COLUMN enquiry_sessions_json TEXT NULL"),
            ("recommendation_text", "ADD COLUMN recommendation_text TEXT NULL"),
            ("recommendation_date", "ADD COLUMN recommendation_date VARCHAR(50) NULL"),
            ("recommendation_file", "ADD COLUMN recommendation_file VARCHAR(255) NULL"),
            ("execution_text", "ADD COLUMN execution_text TEXT NULL"),
            ("execution_date", "ADD COLUMN execution_date VARCHAR(50) NULL"),
            ("closure_note", "ADD COLUMN closure_note TEXT NULL"),
            ("closure_date", "ADD COLUMN closure_date VARCHAR(50) NULL"),
        ]:
            await ensure_column("concerns", column_name, column_sql)
        await db.execute(
            text(
                """
                UPDATE concerns
                SET stage = CASE
                    WHEN status = 'Closed' THEN 7
                    WHEN status = 'Reviewed' THEN 2
                    ELSE 1
                END
                WHERE
                    stage IS NULL
                    OR stage < 1
                    OR (status = 'Closed' AND stage < 7)
                    OR (status = 'Reviewed' AND stage < 2)
                """
            )
        )

        for column_name, column_sql in [
            ("template_name", "ADD COLUMN template_name VARCHAR(100) NULL"),
            ("logo_path", "ADD COLUMN logo_path VARCHAR(255) NULL"),
            ("font_name", "ADD COLUMN font_name VARCHAR(50) NULL DEFAULT 'Helvetica'"),
            ("signature_path", "ADD COLUMN signature_path VARCHAR(255) NULL"),
            ("color_code", "ADD COLUMN color_code VARCHAR(20) NULL DEFAULT '#1a3c5e'"),
            ("company_id", "ADD COLUMN company_id INT NULL"),
            ("status", "ADD COLUMN status VARCHAR(30) NULL DEFAULT 'Pending'"),
            (
                "updated_date",
                "ADD COLUMN updated_date DATETIME DEFAULT CURRENT_TIMESTAMP",
            ),
        ]:
            await ensure_column("certificate_template", column_name, column_sql)

        await db.execute(
            text(
                """
                ALTER TABLE certificate_template
                MODIFY status ENUM('Pending', 'Active', 'Inactive', 'Rejected') DEFAULT 'Pending'
                """
            )
        )

        for column_name, column_sql in [
            ("reference_no", "ADD COLUMN reference_no VARCHAR(50) NULL"),
            ("company_type", "ADD COLUMN company_type VARCHAR(100) NULL"),
            ("company_status_type", "ADD COLUMN company_status_type VARCHAR(50) NULL"),
            (
                "approval_status",
                "ADD COLUMN approval_status VARCHAR(30) NULL DEFAULT 'Pending'",
            ),
            ("client_id", "ADD COLUMN client_id VARCHAR(100) NULL"),
            ("scope_codes_json", "ADD COLUMN scope_codes_json TEXT NULL"),
            ("service_details_json", "ADD COLUMN service_details_json TEXT NULL"),
            ("referral_from", "ADD COLUMN referral_from VARCHAR(100) NULL"),
            ("referral_name", "ADD COLUMN referral_name VARCHAR(150) NULL"),
            ("website", "ADD COLUMN website VARCHAR(200) NULL"),
            ("registration_number", "ADD COLUMN registration_number VARCHAR(50) NULL"),
            ("gst_number", "ADD COLUMN gst_number VARCHAR(50) NULL"),
            ("posh_policy", "ADD COLUMN posh_policy VARCHAR(200) NULL"),
            ("posh_policy_version", "ADD COLUMN posh_policy_version VARCHAR(50) NULL"),
            (
                "posh_policy_effective_date",
                "ADD COLUMN posh_policy_effective_date VARCHAR(50) NULL",
            ),
            (
                "posh_policy_document_path",
                "ADD COLUMN posh_policy_document_path VARCHAR(500) NULL",
            ),
            (
                "posh_policy_document_name",
                "ADD COLUMN posh_policy_document_name VARCHAR(255) NULL",
            ),
            (
                "certificate_issue_mode",
                "ADD COLUMN certificate_issue_mode VARCHAR(20) NULL DEFAULT 'Automatic'",
            ),
            ("employee_strength", "ADD COLUMN employee_strength INT NULL"),
            ("corp_address_json", "ADD COLUMN corp_address_json TEXT NULL"),
            ("billing_address_json", "ADD COLUMN billing_address_json TEXT NULL"),
            ("account_contact_json", "ADD COLUMN account_contact_json TEXT NULL"),
            (
                "coordinator_contact_json",
                "ADD COLUMN coordinator_contact_json TEXT NULL",
            ),
            ("branches_json", "ADD COLUMN branches_json TEXT NULL"),
        ]:
            await ensure_column("company_master", column_name, column_sql)

        for column_name, column_sql in [
            ("office_state", "ADD COLUMN office_state VARCHAR(150) NULL"),
            ("office_city", "ADD COLUMN office_city VARCHAR(150) NULL"),
        ]:
            await ensure_column("posh_offices", column_name, column_sql)

        for column_name, column_sql in [
            ("date_of_birth", "ADD COLUMN date_of_birth DATE NULL"),
            ("father_name", "ADD COLUMN father_name VARCHAR(150) NULL"),
            ("emergency_contact", "ADD COLUMN emergency_contact VARCHAR(20) NULL"),
            ("gender", "ADD COLUMN gender VARCHAR(20) NULL"),
            ("blood_group", "ADD COLUMN blood_group VARCHAR(10) NULL"),
            (
                "physically_challenged",
                "ADD COLUMN physically_challenged VARCHAR(10) NULL",
            ),
            ("marital_status", "ADD COLUMN marital_status VARCHAR(20) NULL"),
            ("pan_number", "ADD COLUMN pan_number VARCHAR(20) NULL"),
            ("foreign_national", "ADD COLUMN foreign_national VARCHAR(10) NULL"),
            ("employment_status", "ADD COLUMN employment_status VARCHAR(50) NULL"),
            ("employee_status", "ADD COLUMN employee_status VARCHAR(50) NULL"),
            ("resignation_date", "ADD COLUMN resignation_date DATE NULL"),
            ("resignation_reason", "ADD COLUMN resignation_reason VARCHAR(255) NULL"),
            ("reporting_to", "ADD COLUMN reporting_to VARCHAR(150) NULL"),
            ("branch_name", "ADD COLUMN branch_name VARCHAR(150) NULL"),
            ("branch_id", "ADD COLUMN branch_id VARCHAR(50) NULL"),
            ("transfer_date", "ADD COLUMN transfer_date DATE NULL"),
            ("transfer_location", "ADD COLUMN transfer_location VARCHAR(150) NULL"),
            (
                "transfer_branch_name",
                "ADD COLUMN transfer_branch_name VARCHAR(150) NULL",
            ),
            ("transfer_branch_id", "ADD COLUMN transfer_branch_id VARCHAR(50) NULL"),
            ("ic_role", "ADD COLUMN ic_role VARCHAR(100) NULL"),
        ]:
            await ensure_column("user_master", column_name, column_sql)

        await db.execute(
            text(
                """
                INSERT INTO role_master (role_id, role_name)
                VALUES
                    (1, 'Super Admin'),
                    (2, 'Admin'),
                    (5, 'Client / Management'),
                    (3, 'IC'),
                    (4, 'Employee')
                ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)
                """
            )
        )

        await db.execute(
            text(
                """
                UPDATE user_master
                SET
                    employee_id = 'IC001',
                    first_name = 'IC',
                    last_name = 'User',
                    email = 'ic@posh.com',
                    username = 'ic@posh.com'
                WHERE
                    role_id = 3
                    AND (
                        email = 'hr@posh.com'
                        OR username = 'hr@posh.com'
                        OR employee_id = 'HR001'
                    )
                    AND NOT EXISTS (
                        SELECT 1
                        FROM (
                            SELECT user_id
                            FROM user_master
                            WHERE
                                email = 'ic@posh.com'
                                OR username = 'ic@posh.com'
                                OR employee_id = 'IC001'
                        ) AS existing_ic_seed
                    )
                """
            )
        )

        await db.execute(
            text(
                """
                INSERT INTO company_master
                    (company_id, company_code, company_name, status, is_deleted)
                VALUES
                    (1, 'DEFAULT', 'XYZ Portal', 'Active', 'N')
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
                "employee_id": "CADMIN001",
                "first_name": "Company",
                "last_name": "Admin",
                "email": "company.admin@posh.com",
                "mobile": "9000000002",
                "role_id": 2,
            },
            {
                "employee_id": "CLIENT001",
                "first_name": "Client",
                "last_name": "Management",
                "email": "client.mgmt@posh.com",
                "mobile": "9000000003",
                "role_id": 5,
            },
            {
                "employee_id": "IC001",
                "first_name": "IC",
                "last_name": "User",
                "email": "ic@posh.com",
                "mobile": "9000000004",
                "role_id": 3,
            },
            {
                "employee_id": "EMP001",
                "first_name": "Employee",
                "last_name": "User",
                "email": "employee@posh.com",
                "mobile": "9000000005",
                "role_id": 4,
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
                    WHERE email IN (
                        'admin@posh.com',
                        'company.admin@posh.com',
                        'client.mgmt@posh.com',
                        'ic@posh.com',
                        'employee@posh.com'
                    )
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
                    ('videos.upload', 'Upload Videos'),
                    ('videos.publish', 'Publish Videos'),
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
                DELETE rp FROM role_permission rp
                JOIN permission_master pm ON pm.permission_id = rp.permission_id
                WHERE
                    (rp.role_id = 2 AND pm.permission_key NOT IN ('users.manage','videos.upload','videos.publish','reports.view'))
                    OR (rp.role_id = 3 AND pm.permission_key IN ('users.manage','videos.manage','videos.upload','training.assign'))
                    OR (rp.role_id = 5 AND pm.permission_key NOT IN ('users.manage','videos.upload','certificates.manage','reports.view'))
                """
            )
        )
        await db.execute(
            text(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT 1, permission_id FROM permission_master
                UNION SELECT 2, permission_id FROM permission_master
                WHERE permission_key IN ('users.manage','videos.upload','videos.publish','reports.view')
                UNION SELECT 5, permission_id FROM permission_master
                WHERE permission_key IN ('users.manage','videos.upload','certificates.manage','reports.view')
                UNION SELECT 3, permission_id FROM permission_master
                WHERE permission_key IN ('reports.view','courses.watch')
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
        await db.execute(
            text(
                """
                INSERT INTO posh_master_codes (category, name, code, description, is_active)
                VALUES
                    ('Country Code', 'INDIA', 'IN', 'Default country code', TRUE),
                    ('State Code', 'Tamil Nadu', 'TN', 'Default state code', TRUE),
                    ('State Code', 'Karnataka', 'KA', 'Default state code', TRUE),
                    ('State Code', 'Maharashtra', 'MH', 'Default state code', TRUE),
                    ('City Code', 'Chennai', 'CHN', 'Default city code', TRUE),
                    ('City Code', 'Bangalore', 'BLR', 'Default city code', TRUE),
                    ('City Code', 'Mumbai', 'MUM', 'Default city code', TRUE),
                    ('Deliverables', 'PoSH Policy', 'POLICY', 'Policy documentation and publishing', TRUE),
                    ('Deliverables', 'Awareness Training', 'TRAINING', 'Training video assignment and completion tracking', TRUE),
                    ('Deliverables', 'Assessment & Certificates', 'CERTIFICATE', 'Assessment and certificate issue flow', TRUE),
                    ('Deliverables', 'Audit-ready Reporting', 'REPORTING', 'Compliance reports and analytics', TRUE),
                    ('Work Order Form', 'POSH Work Order', 'WO-POSH', 'Client POSH compliance work order template', TRUE),
                    ('Create Company', 'Company Registration', 'COMPANY', 'Create company and POSH registration data', TRUE)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    description = VALUES(description),
                    is_active = VALUES(is_active)
                """
            )
        )
        await db.execute(
            text(
                """
                DELETE FROM posh_master_codes
                WHERE category = 'Scope of Work ID'
                """
            )
        )
        await db.execute(
            text(
                """
                INSERT INTO posh_offices
                    (office_name, office_address, office_state, office_city, is_active)
                VALUES
                    ('ADYAR', 'Office Address', 'Tamil Nadu', 'Chennai', TRUE),
                    ('AMBATTAUR', 'Office Address', 'Tamil Nadu', 'Chennai', TRUE),
                    ('BANGALORE', 'Office Address', 'Karnataka', 'Bangalore', TRUE)
                ON DUPLICATE KEY UPDATE
                    office_address = VALUES(office_address),
                    office_state = COALESCE(posh_offices.office_state, VALUES(office_state)),
                    office_city = COALESCE(posh_offices.office_city, VALUES(office_city)),
                    is_active = VALUES(is_active)
                """
            )
        )
        await db.execute(
            text(
                """
                INSERT INTO posh_role_access
                    (role_label, access_item, access_status, is_allowed, display_order)
                VALUES
                    ('Super Admin', 'Home', 'Access enabled', TRUE, 1),
                    ('Super Admin', 'PoSH Policy', 'Access enabled', TRUE, 2),
                    ('Super Admin', 'PoSH Training', 'Access enabled', TRUE, 3),
                    ('Super Admin', 'IC Member Training', 'Access enabled', TRUE, 4),
                    ('Super Admin', 'Assessment & Certificate', 'Access enabled', TRUE, 5),
                    ('Super Admin', 'POSH Compliance', 'Access enabled', TRUE, 6),
                    ('Super Admin', 'POSH Complaints', 'Access enabled', TRUE, 7),
                    ('Super Admin', 'Audit', 'Access enabled', TRUE, 8),
                    ('Super Admin', 'Analytics & Reports', 'Access enabled', TRUE, 9),
                    ('Super Admin', 'Create Admin', 'Access enabled', TRUE, 10),
                    ('Super Admin', 'Create IC', 'Access enabled', TRUE, 11),
                    ('Super Admin', 'Masters', 'Access enabled', TRUE, 12),
                    ('Super Admin', 'Company Setup', 'Access enabled', TRUE, 13),
                    ('Super Admin', 'User Master', 'Access enabled', TRUE, 14),
                    ('Super Admin', 'Annual Returns', 'Access enabled', TRUE, 15),
                    ('Super Admin', 'Client Status', 'Access enabled', TRUE, 16),
                    ('Super Admin', 'Role & Access Matrix', 'Access enabled', TRUE, 17),
                    ('Admin', 'Home', 'Access enabled', TRUE, 1),
                    ('Admin', 'PoSH Policy', 'Access enabled', TRUE, 2),
                    ('Admin', 'PoSH Training', 'Access enabled', TRUE, 3),
                    ('Admin', 'IC Member Training', 'Access enabled', TRUE, 4),
                    ('Admin', 'Company Setup', 'Access enabled', TRUE, 5),
                    ('Admin', 'User Master', 'Access enabled', TRUE, 6),
                    ('Admin', 'Create IC', 'Access enabled', TRUE, 7),
                    ('Admin', 'Masters', 'Access enabled', TRUE, 8),
                    ('Admin', 'Analytics & Reports', 'Access enabled', TRUE, 9),
                    ('Admin', 'Annual Returns', 'Access enabled', TRUE, 10),
                    ('Client Admin (Mgmt)', 'Home', 'Access enabled', TRUE, 1),
                    ('Client Admin (Mgmt)', 'PoSH Policy', 'Access enabled', TRUE, 2),
                    ('Client Admin (Mgmt)', 'PoSH Training', 'Access enabled', TRUE, 3),
                    ('Client Admin (Mgmt)', 'IC Member Training', 'Access enabled', TRUE, 4),
                    ('Client Admin (Mgmt)', 'Assessment & Certificate', 'Access enabled', TRUE, 5),
                    ('Client Admin (Mgmt)', 'POSH Compliance', 'Access enabled', TRUE, 6),
                    ('Client Admin (Mgmt)', 'POSH Complaints', 'Access enabled', TRUE, 7),
                    ('Client Admin (Mgmt)', 'Audit', 'Access enabled', TRUE, 8),
                    ('Client Admin (Mgmt)', 'Analytics & Reports', 'Access enabled', TRUE, 9),
                    ('Client Admin (Mgmt)', 'User Master', 'Access enabled', TRUE, 10),
                    ('Client Admin (Mgmt)', 'Create IC', 'Access enabled', TRUE, 11),
                    ('Client Admin (Mgmt)', 'Annual Returns', 'Access enabled', TRUE, 12),
                    ('IC', 'Home', 'Access enabled', TRUE, 1),
                    ('IC', 'PoSH Policy', 'Access enabled', TRUE, 2),
                    ('IC', 'PoSH Training', 'Access enabled', TRUE, 3),
                    ('IC', 'IC Member Training', 'Access enabled', TRUE, 4),
                    ('IC', 'POSH Compliance', 'Access enabled', TRUE, 5),
                    ('IC', 'POSH Complaints', 'Access enabled', TRUE, 6),
                    ('IC', 'Analytics & Reports', 'Access enabled', TRUE, 7),
                    ('IC', 'User Master', 'NO Access', FALSE, 8),
                    ('Employee', 'Home', 'Access enabled', TRUE, 1),
                    ('Employee', 'PoSH Policy', 'Access enabled', TRUE, 2),
                    ('Employee', 'PoSH Training', 'Access enabled', TRUE, 3),
                    ('Employee', 'Assessment & Certificate', 'Access enabled', TRUE, 4),
                    ('Employee', 'POSH Complaints', 'Access enabled', TRUE, 5)
                ON DUPLICATE KEY UPDATE
                    access_status = VALUES(access_status),
                    is_allowed = VALUES(is_allowed),
                    display_order = VALUES(display_order)
                """
            )
        )
        await db.execute(
            text(
                """
                DELETE old_access
                FROM posh_role_access old_access
                JOIN posh_role_access new_access
                  ON new_access.access_item = old_access.access_item
                 AND new_access.role_label = 'Admin'
                WHERE old_access.role_label IN ('Company Admin', 'Corp Admin')
                """
            )
        )
        await db.execute(
            text(
                """
                UPDATE posh_role_access
                SET role_label = 'Admin'
                WHERE role_label IN ('Company Admin', 'Corp Admin')
                """
            )
        )
        await db.execute(
            text(
                """
                DELETE old_access
                FROM posh_role_access old_access
                JOIN posh_role_access new_access
                  ON new_access.role_label = old_access.role_label
                 AND new_access.access_item = 'User Master'
                WHERE old_access.access_item IN ('Employee Master', 'Employee Master - PoSH')
                """
            )
        )
        await db.execute(
            text(
                """
                UPDATE posh_role_access
                SET access_item = 'User Master'
                WHERE access_item IN ('Employee Master', 'Employee Master - PoSH')
                """
            )
        )
        await db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS annual_returns (
                    annual_return_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    branch_id VARCHAR(80) NOT NULL,
                    branch_name VARCHAR(150) NOT NULL,
                    year INT NOT NULL,
                    return_date DATE NULL,
                    status VARCHAR(30) DEFAULT 'Pending',
                    presiding_officer VARCHAR(150) NULL,
                    complaints_received INT DEFAULT 0,
                    complaints_disposed INT DEFAULT 0,
                    complaints_pending_90 INT DEFAULT 0,
                    workshops_count INT DEFAULT 0,
                    action_taken TEXT NULL,
                    posh_office_recipient TEXT NULL,
                    acknowledgement_proof VARCHAR(255) NULL,
                    training_proof VARCHAR(255) NULL,
                    postal_proof VARCHAR(255) NULL,
                    sector_nature VARCHAR(255) NULL,
                    shift_breakdown TEXT NULL,
                    employees_total INT DEFAULT 0,
                    employees_male INT DEFAULT 0,
                    employees_female INT DEFAULT 0,
                    awareness_attendees INT DEFAULT 0,
                    pending_90_reasons TEXT NULL,
                    workshop_period_from DATE NULL,
                    workshop_period_to DATE NULL,
                    workshop_details TEXT NULL,
                    ic_constituted_date DATE NULL,
                    ic_member_change VARCHAR(255) NULL,
                    orientation_programme_date DATE NULL,
                    policy_disseminated VARCHAR(255) NULL,
                    notice_displayed_from DATE NULL,
                    wfh_awareness_session_date DATE NULL,
                    new_joiner_orientation_timing VARCHAR(255) NULL,
                    posh_awareness_date DATE NULL,
                    posh_awareness_mode VARCHAR(80) NULL,
                    posh_awareness_resource_person VARCHAR(150) NULL,
                    ic_members_json TEXT NULL,
                    complaint_rows_json TEXT NULL,
                    annual_return_copy VARCHAR(255) NULL,
                    registered_post_tracking_number VARCHAR(100) NULL,
                    covering_from_address TEXT NULL,
                    posh_office_name VARCHAR(150) NULL,
                    posh_office_address TEXT NULL,
                    created_by BIGINT NULL,
                    updated_by BIGINT NULL,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_annual_return_company_branch_year (company_id, branch_id, year),
                    INDEX ix_annual_returns_company_year (company_id, year)
                )
                """
            )
        )
        for column_name, column_sql in [
            ("sector_nature", "ADD COLUMN sector_nature VARCHAR(255) NULL"),
            ("shift_breakdown", "ADD COLUMN shift_breakdown TEXT NULL"),
            ("employees_total", "ADD COLUMN employees_total INT DEFAULT 0"),
            ("employees_male", "ADD COLUMN employees_male INT DEFAULT 0"),
            ("employees_female", "ADD COLUMN employees_female INT DEFAULT 0"),
            ("awareness_attendees", "ADD COLUMN awareness_attendees INT DEFAULT 0"),
            ("pending_90_reasons", "ADD COLUMN pending_90_reasons TEXT NULL"),
            ("workshop_period_from", "ADD COLUMN workshop_period_from DATE NULL"),
            ("workshop_period_to", "ADD COLUMN workshop_period_to DATE NULL"),
            ("workshop_details", "ADD COLUMN workshop_details TEXT NULL"),
            ("ic_constituted_date", "ADD COLUMN ic_constituted_date DATE NULL"),
            ("ic_member_change", "ADD COLUMN ic_member_change VARCHAR(255) NULL"),
            ("orientation_programme_date", "ADD COLUMN orientation_programme_date DATE NULL"),
            ("policy_disseminated", "ADD COLUMN policy_disseminated VARCHAR(255) NULL"),
            ("notice_displayed_from", "ADD COLUMN notice_displayed_from DATE NULL"),
            ("wfh_awareness_session_date", "ADD COLUMN wfh_awareness_session_date DATE NULL"),
            (
                "new_joiner_orientation_timing",
                "ADD COLUMN new_joiner_orientation_timing VARCHAR(255) NULL",
            ),
            ("posh_awareness_date", "ADD COLUMN posh_awareness_date DATE NULL"),
            ("posh_awareness_mode", "ADD COLUMN posh_awareness_mode VARCHAR(80) NULL"),
            (
                "posh_awareness_resource_person",
                "ADD COLUMN posh_awareness_resource_person VARCHAR(150) NULL",
            ),
            ("ic_members_json", "ADD COLUMN ic_members_json TEXT NULL"),
            ("complaint_rows_json", "ADD COLUMN complaint_rows_json TEXT NULL"),
            ("annual_return_copy", "ADD COLUMN annual_return_copy VARCHAR(255) NULL"),
            (
                "registered_post_tracking_number",
                "ADD COLUMN registered_post_tracking_number VARCHAR(100) NULL",
            ),
            ("covering_from_address", "ADD COLUMN covering_from_address TEXT NULL"),
            ("posh_office_name", "ADD COLUMN posh_office_name VARCHAR(150) NULL"),
            ("posh_office_address", "ADD COLUMN posh_office_address TEXT NULL"),
        ]:
            await ensure_column("annual_returns", column_name, column_sql)
        await db.execute(
            text(
                """
                DELETE FROM posh_role_access
                WHERE access_item = 'POSH Awareness Training'
                """
            )
        )

        await db.commit()
        print("Auto-seed complete: roles, default company, admin, and IC users are ready.")


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": "XYZ Portal"}


@app.get("/")
async def root():
    return {"message": "XYZ Portal API"}


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
