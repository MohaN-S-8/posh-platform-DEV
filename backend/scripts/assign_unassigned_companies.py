"""Default existing unassigned work orders to the configured primary Super Admin."""

import asyncio
import json
import sys

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal, engine
from app.models.company import CompanyMaster
from app.models.user import UserMaster


async def main():
    engine.echo = False
    async with AsyncSessionLocal() as db:
        primary = await db.get(UserMaster, settings.PRIMARY_SUPER_ADMIN_USER_ID)
        if (
            not primary
            or primary.role_id != 1
            or primary.status != "Active"
            or primary.is_deleted != "N"
        ):
            raise RuntimeError("Configured primary Super Admin is not active.")
        changed = []
        companies = (
            (
                await db.execute(
                    select(CompanyMaster).where(CompanyMaster.is_deleted == "N").with_for_update()
                )
            )
            .scalars()
            .all()
        )
        for company in companies:
            try:
                rows = json.loads(company.service_details_json or "[]")
            except (TypeError, ValueError):
                continue
            if not isinstance(rows, list):
                continue
            updated = False
            for row in rows:
                if isinstance(row, dict) and not row.get("assigned_to"):
                    row.update(
                        assigned_to=str(primary.user_id),
                        assigned_to_name=f"{primary.first_name} {primary.last_name or ''}".strip(),
                        assigned_to_role="Super Admin",
                    )
                    updated = True
            if updated:
                company.service_details_json = json.dumps(rows)
                changed.append(company.company_id)
        if "--apply" in sys.argv:
            await db.commit()
        else:
            await db.rollback()
        print(
            json.dumps(
                {
                    "applied": "--apply" in sys.argv,
                    "company_ids": changed,
                    "assigned_to": primary.user_id,
                }
            )
        )
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
