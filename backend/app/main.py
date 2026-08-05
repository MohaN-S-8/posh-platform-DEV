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
                    (3, 'HR / IC'),
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
                    ('videos.upload', 'Upload Videos'),
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
                    (rp.role_id = 3 AND pm.permission_key = 'videos.manage')
                    OR rp.role_id = 5
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
                UNION SELECT 5, permission_id FROM permission_master
                WHERE permission_key IN ('users.manage')
                UNION SELECT 3, permission_id FROM permission_master
                WHERE permission_key IN ('users.manage','videos.upload','reports.view','training.assign')
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
                    ('Scope of Work ID', 'POSH Compliance', 'POSH', 'Policies, training, assessments, certificates, and reporting', TRUE),
                    ('Scope of Work ID', 'Payroll Services', 'PAYS', 'Payroll service scope', TRUE),
                    ('Scope of Work ID', 'Virtual Office', 'VOFF', 'Virtual office service scope', TRUE),
                    ('Scope of Work ID', 'Recruitment', 'RECR', 'Recruitment service scope', TRUE),
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
                INSERT INTO posh_offices (office_name, office_address, is_active)
                VALUES
                    ('ADYAR', 'Office Address', TRUE),
                    ('AMBATTAUR', 'Office Address', TRUE),
                    ('BANGALORE', 'Office Address', TRUE)
                ON DUPLICATE KEY UPDATE
                    office_address = VALUES(office_address),
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
                    ('Employee', 'Home Page', 'Access enabled', TRUE, 1),
                    ('Employee', 'PoSH Policy', 'Access enabled', TRUE, 2),
                    ('Employee', 'POSH Awareness Training', 'Access enabled', TRUE, 3),
                    ('Employee', 'Assessment & Certificates', 'Access enabled', TRUE, 4),
                    ('Employee', 'Raise POSH Complaints', 'Access enabled', TRUE, 5),
                    ('PO / Member', 'Home Page', 'Access enabled', TRUE, 1),
                    ('PO / Member', 'PoSH Policy', 'Access enabled', TRUE, 2),
                    ('PO / Member', 'POSH Awareness Training', 'Access enabled', TRUE, 3),
                    ('PO / Member', 'IC Training', 'Access enabled', TRUE, 4),
                    ('PO / Member', 'Assessment & Certificates', 'Access enabled', TRUE, 5),
                    ('PO / Member', 'Advance Training', 'NO Access', FALSE, 6),
                    ('PO / Member', 'POSH Compliance', 'Access enabled', TRUE, 7),
                    ('PO / Member', 'Raise POSH Complaints', 'Access enabled', TRUE, 8),
                    ('PO / Member', 'Analytics & Reports', 'Access enabled', TRUE, 9)
                ON DUPLICATE KEY UPDATE
                    access_status = VALUES(access_status),
                    is_allowed = VALUES(is_allowed),
                    display_order = VALUES(display_order)
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
