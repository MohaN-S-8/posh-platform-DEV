from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import _matrix_access_decision, get_current_user
from app.db.session import get_db
from app.schemas.employee import (
    EmployeeCourseResponse,
    EmployeeSummaryResponse,
    EmployeeTrainingHistoryResponse,
)
from app.services.employee_service import EmployeeService
from app.services.policy_ack_service import require_employee_policy_acknowledgement

router = APIRouter(prefix="/employee", tags=["Employee Portal"])
employee_service = EmployeeService()


async def _current_training_user(
    training_type: Literal["posh", "ic"] | None,
    db: AsyncSession,
    current_user,
):
    if current_user.role_id not in [3, 4]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
    if current_user.role_id == 4 and training_type == "ic":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IC Member Training is not available to employee users.",
        )

    access_item = (
        "IC Member Training"
        if current_user.role_id == 3 and training_type == "ic"
        else "PoSH Training"
    )
    decision = await _matrix_access_decision(db, current_user.role_id, [access_item])
    if decision is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
    return current_user


@router.get("/courses", response_model=list[EmployeeCourseResponse])
async def my_courses(
    training_type: Literal["posh", "ic"] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List published courses available to the current IC or employee."""
    current_user = await _current_training_user(training_type, db, current_user)
    await require_employee_policy_acknowledgement(db, current_user)
    return await employee_service.list_courses(
        db,
        current_user.user_id,
        current_user.company_id,
        training_type,
    )


@router.get("/summary", response_model=EmployeeSummaryResponse)
async def my_summary(
    training_type: Literal["posh", "ic"] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return current IC or employee training summary."""
    current_user = await _current_training_user(training_type, db, current_user)
    await require_employee_policy_acknowledgement(db, current_user)
    return await employee_service.summary(
        db,
        current_user.user_id,
        current_user.company_id,
        training_type,
    )


@router.get("/history", response_model=list[EmployeeTrainingHistoryResponse])
async def my_training_history(
    training_type: Literal["posh", "ic"] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return current employee's training history with assessment and certificate details."""
    current_user = await _current_training_user(training_type, db, current_user)
    await require_employee_policy_acknowledgement(db, current_user)
    return await employee_service.training_history(
        db,
        current_user.user_id,
        current_user.company_id,
        training_type,
    )
