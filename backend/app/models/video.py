from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.db.base import Base


class VideoCategory(Base):
    __tablename__ = "video_category"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    category_name = Column(String(100))
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())


class VideoMaster(Base):
    __tablename__ = "video_master"

    video_id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200))
    description = Column(Text)
    category_id = Column(Integer, ForeignKey("video_category.category_id"))
    duration_minutes = Column(Integer)
    video_url = Column(String(500))  # path in MinIO/S3, NOT a public URL
    storage_type = Column(Enum("AWS S3", "Azure Blob", "Local", "MinIO"), default="MinIO")
    status = Column(Enum("Draft", "Published", "Archived"), default="Draft")
    created_by = Column(BigInteger, ForeignKey("user_master.user_id"))
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())


class VideoLanguage(Base):
    """Stores per-language subtitle/audio tracks for a video."""

    __tablename__ = "video_language"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("video_master.video_id"))
    language_id = Column(Integer, ForeignKey("language_master.language_id"))
    subtitle_path = Column(String(255))  # path to .vtt subtitle file in MinIO
    audio_url = Column(String(500))  # path to dubbed audio track in MinIO
    created_date = Column(DateTime, server_default=func.now())
