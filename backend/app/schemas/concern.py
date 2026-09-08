from datetime import datetime

from pydantic import BaseModel, Field


class ConcernEnquirySession(BaseModel):
    date: str = Field(default="", max_length=50)
    present: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=1000)


class ConcernCreate(BaseModel):
    category: str = Field(min_length=2, max_length=100)
    message: str = Field(min_length=5, max_length=2000)
    incident_date: str | None = Field(default=None, max_length=50)
    evidence_note: str | None = Field(default=None, max_length=500)


class ConcernStatusUpdate(BaseModel):
    status: str = Field(pattern="^(Open|Reviewed|Closed)$")


class ConcernManageUpdate(BaseModel):
    stage: int = Field(ge=1, le=7)
    status: str | None = Field(default=None, pattern="^(Open|Reviewed|Closed)$")
    notice_date: str | None = Field(default=None, max_length=50)
    enquiry_sessions: list[ConcernEnquirySession] = Field(default_factory=list)
    recommendation_text: str | None = Field(default=None, max_length=3000)
    recommendation_date: str | None = Field(default=None, max_length=50)
    recommendation_file: str | None = Field(default=None, max_length=255)
    execution_text: str | None = Field(default=None, max_length=3000)
    execution_date: str | None = Field(default=None, max_length=50)
    closure_note: str | None = Field(default=None, max_length=3000)
    closure_date: str | None = Field(default=None, max_length=50)


class ConcernResponse(BaseModel):
    id: int
    user_id: int
    company_id: int
    category: str
    message: str
    status: str
    stage: int | None = None
    stage_label: str | None = None
    days_left: int | None = None
    incident_date: str | None = None
    evidence_note: str | None = None
    notice_date: str | None = None
    enquiry_sessions: list[ConcernEnquirySession] = Field(default_factory=list)
    recommendation_text: str | None = None
    recommendation_date: str | None = None
    recommendation_file: str | None = None
    execution_text: str | None = None
    execution_date: str | None = None
    closure_note: str | None = None
    closure_date: str | None = None
    created_date: datetime | None = None
    reporter_name: str | None = None
    reporter_email: str | None = None
    reporter_role_id: int | None = None
    company_name: str | None = None
    company_code: str | None = None

    model_config = {"from_attributes": True}
