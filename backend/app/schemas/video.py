from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VideoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    service_code: Optional[str] = "POSH"
    training_level: Optional[str] = "Basic"
    target_audience: Optional[str] = "Employee"


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    service_code: Optional[str] = None
    training_level: Optional[str] = None
    target_audience: Optional[str] = None
    status: Optional[str] = None


class VideoResponse(BaseModel):
    video_id: int
    title: str
    description: Optional[str]
    status: str
    duration_minutes: Optional[int]
    service_code: Optional[str] = "POSH"
    training_level: Optional[str] = "Basic"
    target_audience: Optional[str] = "Employee"
    created_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProgressUpdate(BaseModel):
    current_position: int
    total_duration: int


class VideoListResponse(BaseModel):
    video_id: int
    title: str
    description: Optional[str]
    status: str
    duration_minutes: Optional[int]
    service_code: Optional[str] = "POSH"
    training_level: Optional[str] = "Basic"
    target_audience: Optional[str] = "Employee"
    storage_type: Optional[str]
    created_date: Optional[datetime]

    class Config:
        from_attributes = True
