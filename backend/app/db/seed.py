"""
Seed script — run once to populate reference data.
Run with: python -m app.db.seed
"""

import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

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
                    (2, 'Company Admin'),
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

        await db.commit()
        print("✅ Seed complete — roles and default company inserted.")


if __name__ == "__main__":
    asyncio.run(seed())
