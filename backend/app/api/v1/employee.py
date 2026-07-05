from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.employee import (
    EmployeeCourseResponse,
    EmployeeSummaryResponse,
    EmployeeTrainingHistoryResponse,
)
from app.services.employee_service import EmployeeService

router = APIRouter(prefix="/employee", tags=["Employee Portal"])
employee_service = EmployeeService()


@router.get("/courses", response_model=list[EmployeeCourseResponse])
async def my_courses(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List courses assigned to the current employee."""
    return await employee_service.list_courses(db, current_user.user_id, current_user.company_id)


@router.get("/summary", response_model=EmployeeSummaryResponse)
async def my_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return current employee's training summary."""
    return await employee_service.summary(db, current_user.user_id, current_user.company_id)


@router.get("/history", response_model=list[EmployeeTrainingHistoryResponse])
async def my_training_history(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return current employee's training history with assessment and certificate details."""
    return await employee_service.training_history(
        db, current_user.user_id, current_user.company_id
    )
