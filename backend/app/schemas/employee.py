from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EmployeeCourseResponse(BaseModel):
    assignment_id: int
    video_id: int
    title: str
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    assign_type: str
    due_date: Optional[datetime] = None
    passing_score: float
    status: str
    completion_percent: float
    resume_position: int
    assessment_unlocked: bool
    completed_at: Optional[datetime] = None


class EmployeeSummaryResponse(BaseModel):
    total_courses: int
    completed: int
    in_progress: int
    not_started: int
    certificates: int
    completion_rate: float


class EmployeeTrainingHistoryResponse(BaseModel):
    video_id: int
    course_name: str
    status: str
    completion_percent: float
    completion_date: Optional[datetime] = None
    assessment_score: Optional[float] = None
    assessment_result: Optional[str] = None
    certificate_number: Optional[str] = None
    due_date: Optional[datetime] = None
