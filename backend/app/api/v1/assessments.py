from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.db.session import get_db
from app.schemas.assessment import (
    AssessmentQuestionCreate,
    AssessmentQuestionResponse,
    AssessmentSubmit,
)
from app.services.assessment_service import AssessmentService
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/assessments", tags=["Assessments"])
assessment_service = AssessmentService()


@router.get("/{video_id}/questions", response_model=list[AssessmentQuestionResponse])
async def get_questions(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return assessment questions/options for a published company video."""
    return await assessment_service.questions(db, video_id, current_user.company_id)


@router.get("/{video_id}/availability")
async def assessment_availability(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return whether the current user can take the assessment."""
    return await assessment_service.availability(
        db, video_id, current_user.user_id, current_user.company_id
    )


@router.post("/questions", status_code=201)
async def create_assessment_question(
    data: AssessmentQuestionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Admin: add an assessment question/options for a company video."""
    result = await assessment_service.create_question(db, data, current_user.company_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="ASSESSMENT_QUESTION_CREATED",
        table_name="assessment_question",
        record_id=result["question_id"],
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.delete("/questions/{question_id}")
async def delete_assessment_question(
    question_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("videos.manage")),
):
    """Admin: delete an assessment question."""
    result = await assessment_service.delete_question(db, question_id, current_user.company_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="ASSESSMENT_QUESTION_DELETED",
        table_name="assessment_question",
        record_id=question_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/submit")
async def submit_assessment(
    data: AssessmentSubmit,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Submit assessment answers.
    Assessment is locked until video is 95%+ complete.
    Returns score, pass/fail, and triggers certificate on Pass.
    """

    return await assessment_service.submit(db, current_user.user_id, data, current_user.company_id)
