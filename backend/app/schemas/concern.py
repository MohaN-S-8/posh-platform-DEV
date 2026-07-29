from datetime import datetime

from pydantic import BaseModel, Field


class ConcernCreate(BaseModel):
    category: str = Field(min_length=2, max_length=100)
    message: str = Field(min_length=5, max_length=2000)


class ConcernStatusUpdate(BaseModel):
    status: str = Field(pattern="^(Open|Reviewed|Closed)$")


class ConcernResponse(BaseModel):
    id: int
    user_id: int
    company_id: int
    category: str
    message: str
    status: str
    created_date: datetime | None = None
    reporter_name: str | None = None
    reporter_email: str | None = None

    model_config = {"from_attributes": True}
