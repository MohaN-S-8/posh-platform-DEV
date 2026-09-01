from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles_with_matrix
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
    current_user=Depends(require_roles_with_matrix([3, 4], ["POSH Awareness Training"])),
):
    """List published courses available to the current IC or employee."""
    return await employee_service.list_courses(db, current_user.user_id, current_user.company_id)


@router.get("/summary", response_model=EmployeeSummaryResponse)
async def my_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([3, 4], ["POSH Awareness Training"])),
):
    """Return current IC or employee training summary."""
    return await employee_service.summary(db, current_user.user_id, current_user.company_id)


@router.get("/history", response_model=list[EmployeeTrainingHistoryResponse])
async def my_training_history(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([3, 4], ["POSH Awareness Training"])),
):
    """Return current employee's training history with assessment and certificate details."""
    return await employee_service.training_history(
        db, current_user.user_id, current_user.company_id
    )
