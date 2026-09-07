from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.policy import PoshPolicy


async def policy_for_user(db: AsyncSession, current_user) -> PoshPolicy | None:
    company_id = None if current_user.role_id == 1 else current_user.company_id
    if company_id is not None:
        company_result = await db.execute(
            select(PoshPolicy).where(PoshPolicy.company_id == company_id)
        )
        company_policy = company_result.scalar_one_or_none()
        if company_policy:
            return company_policy

    global_result = await db.execute(select(PoshPolicy).where(PoshPolicy.company_id.is_(None)))
    return global_result.scalar_one_or_none()


async def has_policy_acknowledgement(db: AsyncSession, current_user) -> bool:
    policy = await policy_for_user(db, current_user)
    if not policy:
        return False

    result = await db.execute(
        text(
            """
            SELECT 1
            FROM posh_policy_acknowledgement
            WHERE user_id = :user_id
              AND policy_id = :policy_id
              AND policy_version = :policy_version
            LIMIT 1
            """
        ),
        {
            "user_id": current_user.user_id,
            "policy_id": policy.policy_id,
            "policy_version": policy.version or "",
        },
    )
    return result.scalar_one_or_none() is not None


async def require_employee_policy_acknowledgement(
    db: AsyncSession,
    current_user,
) -> None:
    if current_user.role_id != 4:
        return
    if not await has_policy_acknowledgement(db, current_user):
        raise HTTPException(
            403,
            "Please acknowledge the PoSH policy before accessing training.",
        )
