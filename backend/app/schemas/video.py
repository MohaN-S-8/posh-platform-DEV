from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VideoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    duration_minutes: Optional[int] = None


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None


class VideoResponse(BaseModel):
    video_id: int
    title: str
    description: Optional[str]
    status: str
    duration_minutes: Optional[int]
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
    storage_type: Optional[str]
    created_date: Optional[datetime]

    class Config:
        from_attributes = True
