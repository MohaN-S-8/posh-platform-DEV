"""
Seed script — run once to populate reference data.
Run with: python -m app.db.seed
"""

import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import hash_password

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "mysql+asyncmy://posh_user:changeme_password@localhost:3306/posh_db",
)

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed():
    async with AsyncSessionLocal() as db:
        # ── 1. Roles ──────────────────────────────────────────────────────
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

        # ── 2. Default company (needed for signup FK) ─────────────────────
        await db.execute(
            text(
                """
                INSERT IGNORE INTO company_master
                    (company_id, company_code, company_name, status)
                VALUES
                    (1, 'DEFAULT', 'Default Company', 'Active')
            """
            )
        )

        # ── 3. Languages ──────────────────────────────────────────────────
        await db.execute(
            text(
                """
                INSERT IGNORE INTO language_master (language_id, language_name)
                VALUES
                    (1, 'English'),
                    (2, 'Hindi'),
                    (3, 'Tamil'),
                    (4, 'Telugu'),
                    (5, 'Malayalam'),
                    (6, 'Kannada')
            """
            )
        )

        # ── 4. Video Categories ───────────────────────────────────────────
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
                    (rp.role_id = 2 AND pm.permission_key <> 'users.manage')
                    OR (rp.role_id = 3 AND pm.permission_key IN ('videos.manage','reports.view'))
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
                WHERE permission_key IN ('users.manage')
                UNION SELECT 5, permission_id FROM permission_master
                WHERE permission_key IN ('users.manage','videos.upload','certificates.manage','reports.view','training.assign')
                UNION SELECT 3, permission_id FROM permission_master
                WHERE permission_key IN ('users.manage','videos.upload','training.assign')
                UNION SELECT 4, permission_id FROM permission_master
                WHERE permission_key IN ('courses.watch')
            """
            )
        )

        await db.execute(
            text(
                """
                INSERT IGNORE INTO video_category (category_id, category_name)
                VALUES
                    (1, 'POSH Awareness'),
                    (2, 'Workplace Conduct'),
                    (3, 'Case Studies'),
                    (4, 'Reporting Procedures'),
                    (5, 'Annual Refresher')
            """
            )
        )

        default_password_hash = hash_password("Admin@1234")
        default_users = [
            ("ADMIN001", "Super", "Admin", "admin@posh.com", "9000000001", 1),
            (
                "CADMIN001",
                "Company",
                "Admin",
                "company.admin@posh.com",
                "9000000002",
                2,
            ),
            (
                "CLIENT001",
                "Client",
                "Management",
                "client.mgmt@posh.com",
                "9000000003",
                5,
            ),
            ("HR001", "HR", "User", "hr@posh.com", "9000000004", 3),
            ("EMP001", "Employee", "User", "employee@posh.com", "9000000005", 4),
        ]
        for employee_id, first_name, last_name, email, mobile, role_id in default_users:
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
                        password_hash = :password_hash,
                        status = 'Active',
                        is_deleted = 'N'
                    WHERE email = :email
                       OR username = :email
                       OR employee_id = :employee_id
                    """
                ),
                {
                    "employee_id": employee_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "mobile": mobile,
                    "role_id": role_id,
                    "password_hash": default_password_hash,
                },
            )
            await db.execute(
                text(
                    """
                    INSERT INTO user_master
                        (company_id, employee_id, first_name, last_name,
                         email, mobile, role_id, username, password_hash, status, is_deleted)
                    SELECT
                        1, :employee_id, :first_name, :last_name,
                        :email, :mobile, :role_id, :email, :password_hash, 'Active', 'N'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM user_master WHERE email = :email
                    )
                    """
                ),
                {
                    "employee_id": employee_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "mobile": mobile,
                    "role_id": role_id,
                    "password_hash": default_password_hash,
                },
            )

        await db.commit()
        print("✅ Seed complete — roles and default company inserted.")


if __name__ == "__main__":
    asyncio.run(seed())
