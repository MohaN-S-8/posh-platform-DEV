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


@router.get("/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),  # Super Admin only
):
    """Platform-wide analytics for Super Admin."""

    # Total companies
    companies_result = await db.execute(
        select(func.count()).where(
            CompanyMaster.is_deleted == "N", CompanyMaster.status == "Active"
        )
    )
    total_companies = companies_result.scalar() or 0

    # Total users
    users_result = await db.execute(
        select(func.count()).where(UserMaster.is_deleted == "N", UserMaster.status == "Active")
    )
    total_users = users_result.scalar() or 0

    # Total certificates issued
    certs_result = await db.execute(select(func.count()).where(Certificate.status == "Valid"))
    total_certificates = certs_result.scalar() or 0

    # Total completions
    completions_result = await db.execute(
        select(func.count()).where(TrainingHistory.status == "Completed")
    )
    total_completions = completions_result.scalar() or 0

    # Average assessment score
    avg_score_result = await db.execute(
        select(func.avg(AssessmentResult.score)).where(AssessmentResult.result == "Pass")
    )
    avg_score = round(float(avg_score_result.scalar() or 0), 2)

    return {
        "total_companies": total_companies,
        "total_users": total_users,
        "total_certificates_issued": total_certificates,
        "total_course_completions": total_completions,
        "average_pass_score": avg_score,
    }


@router.get("/company/{company_id}")
async def company_analytics(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2])),
):
    """Analytics for a specific company."""
    if current_user.role_id == 2 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to access this company.")

    # Employee counts
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

    cert_result = await db.execute(select(func.count()).where(Certificate.company_id == company_id))
    total_certs = cert_result.scalar() or 0

    compliance_rate = round((completed / total * 100), 2) if total > 0 else 0.0

    return {
        "company_id": company_id,
        "total_employees": total,
        "completed_training": completed,
        "compliance_rate": compliance_rate,
        "certificates_issued": total_certs,
    }
