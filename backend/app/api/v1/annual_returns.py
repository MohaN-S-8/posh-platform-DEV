import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.annual_return import AnnualReturn
from app.models.company import CompanyMaster
from app.models.concern import Concern
from app.models.training import TrainingHistory
from app.models.user import UserMaster
from app.models.video import VideoMaster
from app.schemas.annual_return import AnnualReturnPayload
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/annual-returns", tags=["Annual Returns"])


def _json_list(value) -> list[dict]:
    if not value:
        return []
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _text_or_empty(value) -> str:
    return value or ""


def _annual_extra_fields(saved: AnnualReturn | None, counts: dict | None = None) -> dict:
    if not saved:
        counts = counts or {}
        return {
            "sector_nature": "",
            "shift_breakdown": "",
            "employees_total": counts.get("completed_training_users", 0),
            "employees_male": 0,
            "employees_female": 0,
            "awareness_attendees": counts.get("completed_training_users", 0),
            "pending_90_reasons": "",
            "workshop_period_from": None,
            "workshop_period_to": None,
            "workshop_details": "",
            "ic_constituted_date": None,
            "ic_member_change": "NIL",
            "orientation_programme_date": None,
            "policy_disseminated": "At the time of appointment of employees",
            "notice_displayed_from": None,
            "wfh_awareness_session_date": None,
            "new_joiner_orientation_timing": "Within one month of joining",
            "posh_awareness_date": None,
            "posh_awareness_mode": "In person",
            "posh_awareness_resource_person": "",
            "ic_members_json": "[]",
            "complaint_rows_json": "[]",
            "annual_return_copy": "",
            "registered_post_tracking_number": "",
            "covering_from_address": "",
            "posh_office_name": "",
            "posh_office_address": "",
        }
    return {
        "sector_nature": _text_or_empty(saved.sector_nature),
        "shift_breakdown": _text_or_empty(saved.shift_breakdown),
        "employees_total": saved.employees_total or 0,
        "employees_male": saved.employees_male or 0,
        "employees_female": saved.employees_female or 0,
        "awareness_attendees": saved.awareness_attendees or 0,
        "pending_90_reasons": _text_or_empty(saved.pending_90_reasons),
        "workshop_period_from": saved.workshop_period_from,
        "workshop_period_to": saved.workshop_period_to,
        "workshop_details": _text_or_empty(saved.workshop_details),
        "ic_constituted_date": saved.ic_constituted_date,
        "ic_member_change": _text_or_empty(saved.ic_member_change),
        "orientation_programme_date": saved.orientation_programme_date,
        "policy_disseminated": _text_or_empty(saved.policy_disseminated),
        "notice_displayed_from": saved.notice_displayed_from,
        "wfh_awareness_session_date": saved.wfh_awareness_session_date,
        "new_joiner_orientation_timing": _text_or_empty(saved.new_joiner_orientation_timing),
        "posh_awareness_date": saved.posh_awareness_date,
        "posh_awareness_mode": _text_or_empty(saved.posh_awareness_mode),
        "posh_awareness_resource_person": _text_or_empty(saved.posh_awareness_resource_person),
        "ic_members_json": saved.ic_members_json or "[]",
        "complaint_rows_json": saved.complaint_rows_json or "[]",
        "annual_return_copy": _text_or_empty(saved.annual_return_copy),
        "registered_post_tracking_number": _text_or_empty(saved.registered_post_tracking_number),
        "covering_from_address": _text_or_empty(saved.covering_from_address),
        "posh_office_name": _text_or_empty(saved.posh_office_name),
        "posh_office_address": _text_or_empty(saved.posh_office_address),
    }


def _branches_for_company(company: CompanyMaster) -> list[dict]:
    branches = []
    for index, branch in enumerate(_json_list(company.branches_json), start=1):
        name = (branch.get("branch_name") or "").strip()
        branch_id = (branch.get("branch_id") or "").strip()
        if not name and not branch_id:
            continue
        branches.append(
            {
                "branch_id": branch_id or f"BR-{index}",
                "branch_name": name or branch_id or f"Branch {index}",
            }
        )
    if not branches:
        branches.append(
            {
                "branch_id": "HEAD-OFFICE",
                "branch_name": f"{company.company_name} Head Office",
            }
        )
    return branches


async def _visible_companies(db: AsyncSession, current_user) -> list[CompanyMaster]:
    if current_user.role_id in [1, 2]:
        result = await db.execute(
            select(CompanyMaster)
            .where(
                CompanyMaster.is_deleted == "N",
            )
            .order_by(CompanyMaster.company_name.asc())
        )
        return result.scalars().all()
    if current_user.role_id == 5:
        result = await db.execute(
            select(CompanyMaster).where(
                CompanyMaster.company_id == current_user.company_id,
                CompanyMaster.is_deleted == "N",
            )
        )
        company = result.scalar_one_or_none()
        return [company] if company else []
    raise HTTPException(403, "You do not have permission to access annual returns.")


async def _ensure_company_access(
    db: AsyncSession,
    company_id: int,
    current_user,
) -> CompanyMaster:
    companies = await _visible_companies(db, current_user)
    company = next((item for item in companies if item.company_id == company_id), None)
    if not company:
        raise HTTPException(403, "You do not have permission to access this annual return.")
    return company


async def _branch_counts(
    db: AsyncSession,
    company_id: int,
    branch_id: str,
    branch_name: str,
    year: int,
) -> dict:
    year_start = datetime(year, 1, 1)
    next_year = datetime(year + 1, 1, 1)
    pending_cutoff = datetime.utcnow() - timedelta(days=90)
    branch_filters = []
    if branch_id != "HEAD-OFFICE":
        branch_filters.append(
            or_(UserMaster.branch_id == branch_id, UserMaster.branch_name == branch_name)
        )

    complaint_result = await db.execute(
        select(Concern.status, func.count())
        .join(UserMaster, UserMaster.user_id == Concern.user_id)
        .where(
            Concern.company_id == company_id,
            Concern.created_date >= year_start,
            Concern.created_date < next_year,
            *branch_filters,
        )
        .group_by(Concern.status)
    )
    complaints = {str(status or "Open"): count for status, count in complaint_result.all()}
    pending_90_result = await db.execute(
        select(func.count())
        .select_from(Concern)
        .join(UserMaster, UserMaster.user_id == Concern.user_id)
        .where(
            Concern.company_id == company_id,
            Concern.created_date >= year_start,
            Concern.created_date < next_year,
            Concern.created_date <= pending_cutoff,
            Concern.status != "Closed",
            *branch_filters,
        )
    )
    workshops_result = await db.execute(
        select(func.count(VideoMaster.video_id.distinct())).where(
            VideoMaster.company_id == company_id,
            VideoMaster.status == "Published",
        )
    )
    completed_users_result = await db.execute(
        select(func.count(TrainingHistory.user_id.distinct()))
        .join(UserMaster, UserMaster.user_id == TrainingHistory.user_id)
        .where(
            TrainingHistory.company_id == company_id,
            TrainingHistory.status == "Completed",
            TrainingHistory.updated_date >= year_start,
            TrainingHistory.updated_date < next_year,
            *branch_filters,
        )
    )
    return {
        "complaints_received": sum(complaints.values()),
        "complaints_disposed": complaints.get("Closed", 0),
        "complaints_pending_90": pending_90_result.scalar() or 0,
        "workshops_count": workshops_result.scalar() or 0,
        "completed_training_users": completed_users_result.scalar() or 0,
    }


async def _serialize_return(
    db: AsyncSession,
    company: CompanyMaster,
    branch: dict,
    year: int,
    saved: AnnualReturn | None,
) -> dict:
    counts = await _branch_counts(
        db,
        company.company_id,
        branch["branch_id"],
        branch["branch_name"],
        year,
    )
    if saved:
        return {
            "annual_return_id": saved.annual_return_id,
            "company_id": company.company_id,
            "company_name": company.company_name,
            "company_code": company.company_code,
            "branch_id": saved.branch_id,
            "branch_name": saved.branch_name,
            "year": saved.year,
            "return_date": saved.return_date,
            "status": saved.status or "Pending",
            "presiding_officer": saved.presiding_officer,
            "complaints_received": saved.complaints_received,
            "complaints_disposed": saved.complaints_disposed,
            "complaints_pending_90": saved.complaints_pending_90,
            "workshops_count": saved.workshops_count,
            "action_taken": saved.action_taken,
            "posh_office_recipient": saved.posh_office_recipient,
            "acknowledgement_proof": saved.acknowledgement_proof,
            "training_proof": saved.training_proof,
            "postal_proof": saved.postal_proof,
            "completed_training_users": counts["completed_training_users"],
            **_annual_extra_fields(saved, counts),
        }
    return {
        "annual_return_id": None,
        "company_id": company.company_id,
        "company_name": company.company_name,
        "company_code": company.company_code,
        "branch_id": branch["branch_id"],
        "branch_name": branch["branch_name"],
        "year": year,
        "return_date": None,
        "status": "Pending",
        "presiding_officer": None,
        "complaints_received": counts["complaints_received"],
        "complaints_disposed": counts["complaints_disposed"],
        "complaints_pending_90": counts["complaints_pending_90"],
        "workshops_count": counts["workshops_count"],
        "action_taken": "",
        "posh_office_recipient": "",
        "acknowledgement_proof": "",
        "training_proof": "",
        "postal_proof": "",
        "completed_training_users": counts["completed_training_users"],
        **_annual_extra_fields(None, counts),
    }


@router.get("/")
async def list_annual_returns(
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """List annual returns visible to the current role."""
    target_year = year or date.today().year
    companies = await _visible_companies(db, current_user)
    rows = []
    for company in companies:
        saved_result = await db.execute(
            select(AnnualReturn).where(
                AnnualReturn.company_id == company.company_id,
                AnnualReturn.year == target_year,
            )
        )
        saved_by_key = {(item.branch_id, item.year): item for item in saved_result.scalars().all()}
        for branch in _branches_for_company(company):
            rows.append(
                await _serialize_return(
                    db,
                    company,
                    branch,
                    target_year,
                    saved_by_key.get((branch["branch_id"], target_year)),
                )
            )
    return {
        "scope": "platform" if current_user.role_id in [1, 2] else "company",
        "year": target_year,
        "rows": rows,
        "summary": {
            "submitted": sum(1 for row in rows if row["status"] == "Submitted"),
            "pending": sum(1 for row in rows if row["status"] != "Submitted"),
            "companies": len({row["company_id"] for row in rows}),
            "branches": len(rows),
        },
    }


@router.put("/")
async def save_annual_return(
    data: AnnualReturnPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Create or update one annual return for a company branch/year."""
    company = await _ensure_company_access(db, data.company_id, current_user)
    branch_ids = {branch["branch_id"] for branch in _branches_for_company(company)}
    if data.branch_id not in branch_ids:
        raise HTTPException(400, "Branch is not registered for this company.")
    if data.status not in {"Pending", "Draft", "Submitted"}:
        raise HTTPException(400, "Status must be Pending, Draft, or Submitted.")

    result = await db.execute(
        select(AnnualReturn).where(
            AnnualReturn.company_id == data.company_id,
            AnnualReturn.branch_id == data.branch_id,
            AnnualReturn.year == data.year,
        )
    )
    annual_return = result.scalar_one_or_none()
    if not annual_return:
        annual_return = AnnualReturn(
            company_id=data.company_id,
            branch_id=data.branch_id,
            year=data.year,
            created_by=current_user.user_id,
        )
        db.add(annual_return)

    for field, value in data.model_dump(exclude={"company_id"}).items():
        setattr(annual_return, field, value)
    annual_return.updated_by = current_user.user_id
    await db.flush()
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=data.company_id,
        action="ANNUAL_RETURN_SAVED",
        table_name="annual_returns",
        record_id=annual_return.annual_return_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(annual_return)
    return await _serialize_return(
        db,
        company,
        {"branch_id": annual_return.branch_id, "branch_name": annual_return.branch_name},
        annual_return.year,
        annual_return,
    )


@router.get("/{annual_return_id}/cover-letter")
async def annual_return_cover_letter(
    annual_return_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Return printable covering-letter text for a saved annual return."""
    result = await db.execute(
        select(AnnualReturn, CompanyMaster)
        .join(CompanyMaster, CompanyMaster.company_id == AnnualReturn.company_id)
        .where(AnnualReturn.annual_return_id == annual_return_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Annual return not found.")
    annual_return, company = row
    await _ensure_company_access(db, company.company_id, current_user)
    content = f"""
    <html><body style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Covering Letter - Annual Return {annual_return.year}</h2>
      <p>To,<br />{annual_return.posh_office_recipient or 'The District Officer'}</p>
      <p>
        Please find enclosed the Annual Return under Section 21(1) / Rule 14
        for {company.company_name}, {annual_return.branch_name}, for the year
        {annual_return.year}.
      </p>
      <p>Status: <strong>{annual_return.status}</strong></p>
      <p>Presiding Officer: {annual_return.presiding_officer or '-'}</p>
      <p style="margin-top: 48px;">Authorized Signatory</p>
    </body></html>
    """
    return Response(content=content, media_type="text/html")
