from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_roles_with_matrix
from app.db.session import get_db
from app.models.company import CompanyMaster
from app.models.concern import Concern
from app.models.user import UserMaster
from app.schemas.concern import ConcernCreate, ConcernStatusUpdate
from app.services.audit_service import write_audit_log
from app.services.company_service import CompanyService
from app.services.notification_service import notification_service

router = APIRouter(prefix="/concerns", tags=["Concerns"])
company_service = CompanyService()


async def _visible_concern_company_ids(db: AsyncSession, current_user) -> list[int] | None:
    if current_user.role_id == 1:
        return None
    if current_user.role_id == 2:
        companies = await company_service.get_visible_for_user(db, current_user)
        company_ids = [company.company_id for company in companies]
        if current_user.company_id and current_user.company_id != 1:
            company_ids.append(current_user.company_id)
        return sorted(set(company_ids))
    return [current_user.company_id]


async def _ensure_can_see_concern(db: AsyncSession, current_user, concern: Concern) -> None:
    company_ids = await _visible_concern_company_ids(db, current_user)
    if company_ids is not None and concern.company_id not in company_ids:
        raise HTTPException(403, "You cannot access this concern.")


@router.post("/", status_code=status.HTTP_201_CREATED)
async def submit_concern(
    data: ConcernCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([3, 4], ["POSH Complaints"])),
):
    concern = Concern(
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        category=data.category.strip(),
        message=data.message.strip(),
        status="Open",
    )
    db.add(concern)
    await db.flush()
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="CONCERN_SUBMITTED",
        table_name="concerns",
        record_id=concern.id,
        ip_address=request.client.host if request.client else None,
    )
    admin_ids = await notification_service.active_user_ids_by_roles(
        db,
        company_id=current_user.company_id,
        role_ids=[2, 5, 3],
        exclude_user_id=current_user.user_id,
    )
    await notification_service.create_for_user_ids(
        db,
        user_ids=admin_ids,
        company_id=current_user.company_id,
        title="Concern received",
        message=f"{concern.category} submitted by {current_user.email}.",
    )
    await db.commit()
    await db.refresh(concern)
    return {
        "id": concern.id,
        "message": "Concern submitted successfully.",
        "status": concern.status,
    }


@router.get("/received")
async def received_concerns(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], ["POSH Complaints"])),
):
    query = (
        select(Concern, UserMaster, CompanyMaster)
        .join(UserMaster, Concern.user_id == UserMaster.user_id)
        .join(CompanyMaster, Concern.company_id == CompanyMaster.company_id)
        .order_by(Concern.created_date.desc(), Concern.id.desc())
        .limit(100)
    )
    company_ids = await _visible_concern_company_ids(db, current_user)
    if company_ids is not None:
        if not company_ids:
            return []
        query = query.where(Concern.company_id.in_(company_ids))
    result = await db.execute(query)
    return [
        {
            "id": concern.id,
            "user_id": concern.user_id,
            "company_id": concern.company_id,
            "category": concern.category,
            "message": concern.message,
            "status": concern.status,
            "created_date": concern.created_date,
            "company_name": company.company_name,
            "company_code": company.company_code,
            "reporter_name": f"{user.first_name} {user.last_name or ''}".strip(),
            "reporter_email": user.email,
            "reporter_role_id": user.role_id,
        }
        for concern, user, company in result.all()
    ]


@router.get("/my")
async def my_concerns(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Concern)
        .where(
            Concern.user_id == current_user.user_id,
            Concern.company_id == current_user.company_id,
        )
        .order_by(Concern.created_date.desc(), Concern.id.desc())
        .limit(50)
    )
    return [
        {
            "id": concern.id,
            "category": concern.category,
            "message": concern.message,
            "status": concern.status,
            "created_date": concern.created_date,
        }
        for concern in result.scalars().all()
    ]


@router.patch("/{concern_id}/status")
async def update_concern_status(
    concern_id: int,
    data: ConcernStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([1, 5, 3], ["POSH Complaints"])),
):
    result = await db.execute(select(Concern).where(Concern.id == concern_id))
    concern = result.scalar_one_or_none()
    if not concern:
        raise HTTPException(404, "Concern not found.")
    await _ensure_can_see_concern(db, current_user, concern)

    concern.status = data.status
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=concern.company_id,
        action=f"CONCERN_{data.status.upper()}",
        table_name="concerns",
        record_id=concern.id,
        ip_address=request.client.host if request.client else None,
    )
    await notification_service.create_for_user_ids(
        db,
        user_ids=[concern.user_id],
        company_id=concern.company_id,
        title="Concern status updated",
        message=f"Your concern is now {data.status}.",
    )
    await db.commit()
    await db.refresh(concern)
    return {"id": concern.id, "status": concern.status}
