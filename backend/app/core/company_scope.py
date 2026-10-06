import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.company import CompanyMaster


async def assigned_company_ids(db: AsyncSession, current_user) -> list[int]:
    if current_user.role_id == 1 and current_user.user_id == settings.PRIMARY_SUPER_ADMIN_USER_ID:
        result = await db.execute(
            select(CompanyMaster.company_id).where(CompanyMaster.is_deleted == "N")
        )
        return list(result.scalars().all())
    if current_user.role_id not in (1, 2):
        return [current_user.company_id]
    result = await db.execute(
        select(CompanyMaster.company_id, CompanyMaster.service_details_json).where(
            CompanyMaster.is_deleted == "N"
        )
    )
    company_ids = []
    for company_id, details in result.all():
        try:
            services = json.loads(details or "[]")
        except (TypeError, ValueError):
            continue
        if isinstance(services, list) and any(
            isinstance(service, dict)
            and str(service.get("assigned_to") or "") == str(current_user.user_id)
            for service in services
        ):
            company_ids.append(company_id)
    return company_ids
