from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import UserMaster


class CurrentUser:
    """Holds the authenticated user's info — passed to every protected route."""

    def __init__(self, user: UserMaster):
        self.user_id = user.user_id
        self.company_id = user.company_id
        self.role_id = user.role_id
        self.email = user.email
        self.first_name = user.first_name
        self.status = user.status


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:

    # print("🔥 TOKEN:", token)

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Please log in.",
    )

    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id = payload.get("user_id")
    if not user_id:
        raise credentials_exception

    result = await db.execute(
        select(UserMaster).where(
            UserMaster.user_id == user_id,
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise credentials_exception

    return CurrentUser(user)


def require_role(role_id: int):
    """
    Dependency factory — restricts endpoint to a specific role.
    Usage: Depends(require_role(1))  ← Super Admin only
    """

    async def checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role_id != role_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    return checker


def require_roles(role_ids: list[int]):
    """
    Dependency factory — restricts endpoint to multiple allowed roles.
    Usage: Depends(require_roles([1, 2]))  ← Super Admin or Company Admin
    """

    async def checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role_id not in role_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    return checker


def require_permission(permission_key: str):
    """Restrict endpoint access using role_permission instead of role ids."""

    async def checker(
        current_user: CurrentUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        if current_user.role_id == 1:
            return current_user

        result = await db.execute(
            text(
                """
                SELECT 1
                FROM role_permission rp
                JOIN permission_master pm ON pm.permission_id = rp.permission_id
                WHERE rp.role_id = :role_id
                  AND pm.permission_key = :permission_key
                LIMIT 1
                """
            ),
            {"role_id": current_user.role_id, "permission_key": permission_key},
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    return checker
