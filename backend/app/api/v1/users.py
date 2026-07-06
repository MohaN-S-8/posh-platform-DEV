from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.core.roles import ROLE_CREATION_RULES, SUPER_ADMIN
from app.db.session import get_db
from app.schemas.user import PasswordResetByAdmin, UserCreate, UserResponse, UserUpdate
from app.services.audit_service import write_audit_log
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["User Management"])
user_service = UserService()


def manageable_roles_for(role_id: int) -> set[int]:
    return ROLE_CREATION_RULES.get(role_id, set())


def scoped_company_id(current_user) -> Optional[int]:
    return None if current_user.role_id == SUPER_ADMIN else current_user.company_id


def ensure_can_manage_role(current_user, role_id: int) -> None:
    if role_id not in manageable_roles_for(current_user.role_id):
        raise HTTPException(
            status_code=403,
            detail="This role cannot create or manage the selected user role.",
        )


@router.get("/", response_model=list[UserResponse])
async def list_users(
    company_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """List users visible to the current role according to the PDF hierarchy."""
    if current_user.role_id != SUPER_ADMIN:
        company_id = current_user.company_id
    return await user_service.get_all(db, company_id, manageable_roles_for(current_user.role_id))


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Create only the next role allowed by the PDF user-management flow."""
    ensure_can_manage_role(current_user, data.role_id)
    if current_user.role_id != SUPER_ADMIN:
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
    """Get a user by ID if the current role can manage that user's role."""
    return await user_service.get_by_id(
        db,
        user_id,
        scoped_company_id(current_user),
        manageable_roles_for(current_user.role_id),
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """Update user details within the current role's manageable scope."""
    manageable_roles = manageable_roles_for(current_user.role_id)
    if data.role_id is not None:
        ensure_can_manage_role(current_user, data.role_id)
    user = await user_service.update(
        db,
        user_id,
        data,
        scoped_company_id(current_user),
        manageable_roles,
    )
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
    """Activate or deactivate a manageable user."""
    if status not in ["Active", "Inactive"]:
        raise HTTPException(400, "Status must be 'Active' or 'Inactive'")
    result = await user_service.set_status(
        db,
        user_id,
        status,
        scoped_company_id(current_user),
        manageable_roles_for(current_user.role_id),
    )
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
    """Reset password for a manageable user."""
    result = await user_service.reset_password(
        db,
        user_id,
        data.new_password,
        scoped_company_id(current_user),
        manageable_roles_for(current_user.role_id),
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
    """Soft-delete a manageable user."""
    result = await user_service.delete(
        db,
        user_id,
        scoped_company_id(current_user),
        manageable_roles_for(current_user.role_id),
    )
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
