from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.db.session import get_db
from app.schemas.user import PasswordResetByAdmin, UserCreate, UserResponse, UserUpdate
from app.services.audit_service import write_audit_log
from app.services.company_service import CompanyService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["User Management"])
user_service = UserService()
company_service = CompanyService()

ROLE_SUPER_ADMIN = 1
ROLE_COMPANY_ADMIN = 2
ROLE_CLIENT_MANAGEMENT = 5
ROLE_HR_IC = 3
ROLE_EMPLOYEE = 4

ROLE_CREATE_FLOW = {
    ROLE_SUPER_ADMIN: {ROLE_COMPANY_ADMIN},
    ROLE_COMPANY_ADMIN: {ROLE_CLIENT_MANAGEMENT},
    ROLE_CLIENT_MANAGEMENT: {ROLE_HR_IC},
    ROLE_HR_IC: {ROLE_EMPLOYEE},
}

ROLE_VISIBLE_FLOW = {
    ROLE_SUPER_ADMIN: {ROLE_COMPANY_ADMIN},
    ROLE_COMPANY_ADMIN: {ROLE_CLIENT_MANAGEMENT},
    ROLE_CLIENT_MANAGEMENT: {ROLE_HR_IC, ROLE_EMPLOYEE},
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


async def _visible_company_ids(db: AsyncSession, current_user) -> list[int] | None:
    if current_user.role_id == ROLE_SUPER_ADMIN:
        return None
    if current_user.role_id == ROLE_COMPANY_ADMIN:
        companies = await company_service.get_visible_for_user(db, current_user)
        return [company.company_id for company in companies]
    return [current_user.company_id]


async def _ensure_can_manage_user(db: AsyncSession, current_user, target) -> None:
    from fastapi import HTTPException

    _ensure_can_manage_role(current_user, target.role_id)
    visible_company_ids = await _visible_company_ids(db, current_user)
    if visible_company_ids is not None and target.company_id not in visible_company_ids:
        raise HTTPException(
            403,
            "This account cannot manage users outside its assigned companies.",
        )


async def _ensure_can_create_in_company(db: AsyncSession, current_user, company_id: int) -> None:
    from fastapi import HTTPException

    visible_company_ids = await _visible_company_ids(db, current_user)
    if visible_company_ids is not None and company_id not in visible_company_ids:
        raise HTTPException(
            403,
            "This account cannot create users outside its assigned companies.",
        )


@router.get("/", response_model=list[UserResponse])
async def list_users(
    company_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.manage")),
):
    """List users according to the configured role-management flow."""
    if current_user.role_id == ROLE_COMPANY_ADMIN:
        company_ids = await _visible_company_ids(db, current_user)
        return await user_service.get_all_for_companies(
            db,
            company_ids or [],
            _visible_role_ids(current_user),
        )
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
    if current_user.role_id == ROLE_COMPANY_ADMIN:
        await _ensure_can_create_in_company(db, current_user, data.company_id)
    elif current_user.role_id != ROLE_SUPER_ADMIN:
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
    user = await user_service.get_by_id(
        db,
        user_id,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
    )
    await _ensure_can_manage_user(db, current_user, user)
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
    existing = await user_service.get_by_id(
        db,
        user_id,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
    )
    await _ensure_can_manage_user(db, current_user, existing)
    if data.role_id is not None:
        _ensure_can_manage_role(current_user, data.role_id)
    user = await user_service.update(
        db,
        user_id,
        data,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
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
    """Activate or deactivate a user."""
    if status not in ["Active", "Inactive"]:
        from fastapi import HTTPException

        raise HTTPException(400, "Status must be 'Active' or 'Inactive'")
    existing = await user_service.get_by_id(
        db,
        user_id,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
    )
    await _ensure_can_manage_user(db, current_user, existing)
    result = await user_service.set_status(
        db,
        user_id,
        status,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
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
    """Admin resets a user's password."""
    existing = await user_service.get_by_id(
        db,
        user_id,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
    )
    await _ensure_can_manage_user(db, current_user, existing)
    result = await user_service.reset_password(
        db,
        user_id,
        data.new_password,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
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
    existing = await user_service.get_by_id(
        db,
        user_id,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
    )
    await _ensure_can_manage_user(db, current_user, existing)
    result = await user_service.delete(
        db,
        user_id,
        (None if current_user.role_id == ROLE_COMPANY_ADMIN else _managed_company_id(current_user)),
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
