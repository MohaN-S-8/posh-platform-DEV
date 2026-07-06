from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.db.session import get_db
from app.models.certificate import Certificate
from app.models.company import CompanyMaster
from app.models.training import AssessmentResult, TrainingHistory
from app.models.user import UserMaster

router = APIRouter(prefix="/analytics", tags=["Analytics"])


async def _platform_overview(db: AsyncSession) -> dict:
    companies_result = await db.execute(
        select(func.count()).where(
            CompanyMaster.is_deleted == "N", CompanyMaster.status == "Active"
        )
    )
    total_companies = companies_result.scalar() or 0

    users_result = await db.execute(
        select(func.count()).where(UserMaster.is_deleted == "N", UserMaster.status == "Active")
    )
    total_users = users_result.scalar() or 0

    certs_result = await db.execute(select(func.count()).where(Certificate.status == "Valid"))
    total_certificates = certs_result.scalar() or 0

    completions_result = await db.execute(
        select(func.count()).where(TrainingHistory.status == "Completed")
    )
    total_completions = completions_result.scalar() or 0

    avg_score_result = await db.execute(
        select(func.avg(AssessmentResult.score)).where(AssessmentResult.result == "Pass")
    )
    avg_score = round(float(avg_score_result.scalar() or 0), 2)

    return {
        "scope": "platform",
        "total_companies": total_companies,
        "total_users": total_users,
        "total_certificates_issued": total_certificates,
        "total_course_completions": total_completions,
        "average_pass_score": avg_score,
    }


async def _company_overview(db: AsyncSession, company_id: int) -> dict:
    total_result = await db.execute(
        select(func.count()).where(
            UserMaster.company_id == company_id,
            UserMaster.is_deleted == "N",
            UserMaster.role_id == 4,
        )
    )
    total = total_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count(TrainingHistory.user_id.distinct())).where(
            TrainingHistory.company_id == company_id,
            TrainingHistory.status == "Completed",
        )
    )
    completed = completed_result.scalar() or 0

    in_progress_result = await db.execute(
        select(func.count(TrainingHistory.user_id.distinct())).where(
            TrainingHistory.company_id == company_id,
            TrainingHistory.status == "In Progress",
        )
    )
    in_progress = in_progress_result.scalar() or 0

    cert_result = await db.execute(select(func.count()).where(Certificate.company_id == company_id))
    total_certs = cert_result.scalar() or 0

    avg_score_result = await db.execute(
        select(func.avg(AssessmentResult.score)).where(
            AssessmentResult.video_id.in_(
                select(TrainingHistory.video_id).where(TrainingHistory.company_id == company_id)
            ),
            AssessmentResult.result == "Pass",
        )
    )
    avg_score = round(float(avg_score_result.scalar() or 0), 2)
    compliance_rate = round((completed / total * 100), 2) if total > 0 else 0.0

    return {
        "scope": "company",
        "company_id": company_id,
        "total_employees": total,
        "completed_training": completed,
        "in_progress_training": in_progress,
        "not_started_training": max(total - completed - in_progress, 0),
        "compliance_rate": compliance_rate,
        "certificates_issued": total_certs,
        "average_pass_score": avg_score,
    }


@router.get("/current")
async def current_analytics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2])),
):
    """Analytics for the current admin scope."""
    if current_user.role_id == 1:
        return await _platform_overview(db)
    return await _company_overview(db, current_user.company_id)


@router.get("/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),  # Super Admin only
):
    """Platform-wide analytics for Super Admin."""
    return await _platform_overview(db)


@router.get("/company/{company_id}")
async def company_analytics(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2])),
):
    """Analytics for a specific company."""
    if current_user.role_id != 1 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to access this company.")

    return await _company_overview(db, company_id)
