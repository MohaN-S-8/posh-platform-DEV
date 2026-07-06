from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.db.session import get_db
from app.schemas.user import PasswordResetByAdmin, UserCreate, UserResponse, UserUpdate
from app.services.audit_service import write_audit_log
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["User Management"])
user_service = UserService()

ROLE_SUPER_ADMIN = 1
ROLE_COMPANY_ADMIN = 2
ROLE_HR_IC = 3
ROLE_EMPLOYEE = 4

ROLE_CREATE_FLOW = {
    ROLE_SUPER_ADMIN: {ROLE_COMPANY_ADMIN},
    ROLE_COMPANY_ADMIN: {ROLE_HR_IC},
    ROLE_HR_IC: {ROLE_EMPLOYEE},
}

ROLE_VISIBLE_FLOW = {
    ROLE_SUPER_ADMIN: {ROLE_COMPANY_ADMIN},
    ROLE_COMPANY_ADMIN: {ROLE_HR_IC, ROLE_EMPLOYEE},
    ROLE_HR_IC: {ROLE_EMPLOYEE},
}


def _managed_company_id(current_user):
    return None if current_user.role_id == ROLE_SUPER_ADMIN else current_user.company_id


def _visible_role_ids(current_user):
    return ROLE_VISIBLE_FLOW.get(current_user.role_id, set())


def _ensure_can_manage_role(current_user, role_id: int) -> None:
    from fastapi import HTTPException

    allowed_roles = ROLE_CREATE_FLOW.get(current_user.role_id, set())
    if role_id not in allowed_roles:
        raise HTTPException(
            403,
            "This account cannot manage that role in the configured user-management flow.",
        )


@router.get("/", response_model=list[UserResponse])
async def list_users(
    company_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """List users according to the configured role-management flow."""
    if current_user.role_id != ROLE_SUPER_ADMIN:
        company_id = current_user.company_id
    return await user_service.get_all(db, company_id, _visible_role_ids(current_user))


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Create a new user."""
    _ensure_can_manage_role(current_user, data.role_id)
    if current_user.role_id != ROLE_SUPER_ADMIN:
        data.company_id = current_user.company_id
    user = await user_service.create(db, data)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="USER_CREATED",
        table_name="user_master",
        record_id=user.user_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Get a user by ID."""
    user = await user_service.get_by_id(db, user_id, _managed_company_id(current_user))
    _ensure_can_manage_role(current_user, user.role_id)
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Update user details."""
    existing = await user_service.get_by_id(db, user_id, _managed_company_id(current_user))
    _ensure_can_manage_role(current_user, existing.role_id)
    if data.role_id is not None:
        _ensure_can_manage_role(current_user, data.role_id)
    user = await user_service.update(db, user_id, data, _managed_company_id(current_user))
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="USER_UPDATED",
        table_name="user_master",
        record_id=user_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return user


@router.patch("/{user_id}/status")
async def update_user_status(
    user_id: int,
    status: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Activate or deactivate a user."""
    if status not in ["Active", "Inactive"]:
        from fastapi import HTTPException

        raise HTTPException(400, "Status must be 'Active' or 'Inactive'")
    existing = await user_service.get_by_id(db, user_id, _managed_company_id(current_user))
    _ensure_can_manage_role(current_user, existing.role_id)
    result = await user_service.set_status(db, user_id, status, _managed_company_id(current_user))
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action=f"USER_{status.upper()}",
        table_name="user_master",
        record_id=user_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/{user_id}/reset-password")
async def admin_reset_password(
    user_id: int,
    data: PasswordResetByAdmin,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Admin resets a user's password."""
    existing = await user_service.get_by_id(db, user_id, _managed_company_id(current_user))
    _ensure_can_manage_role(current_user, existing.role_id)
    result = await user_service.reset_password(
        db, user_id, data.new_password, _managed_company_id(current_user)
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="USER_PASSWORD_RESET",
        table_name="user_master",
        record_id=user_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Soft-delete a user according to the configured role-management flow."""
    existing = await user_service.get_by_id(db, user_id, _managed_company_id(current_user))
    _ensure_can_manage_role(current_user, existing.role_id)
    result = await user_service.delete(db, user_id, _managed_company_id(current_user))
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="USER_DELETED",
        table_name="user_master",
        record_id=user_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result
