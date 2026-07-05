from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr


class EmployeeRowSchema(BaseModel):
    """
    Represents one row in the uploaded Excel/CSV file.
    Every field is Optional at parse time — we validate manually
    so we can give per-row error messages instead of crashing.
    """

    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    role_id: Optional[int] = None


class TrainingAssignRequest(BaseModel):
    video_id: int
    assign_type: str  # Individual / Department / Company-Wide
    assigned_to_user_id: Optional[int] = None
    assigned_to_department: Optional[str] = None
    due_days: int = 30  # due in N days from now
    passing_score: float = 70.0


class ComplianceDashboard(BaseModel):
    total_employees: int
    completed: int
    in_progress: int
    not_started: int
    compliance_rate: float
    department_breakdown: list[dict]
    overdue_employees: list[dict]
