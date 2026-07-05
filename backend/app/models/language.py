from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db.base import Base


class LanguageMaster(Base):
    __tablename__ = "language_master"

    language_id = Column(Integer, primary_key=True, autoincrement=True)
    language_name = Column(String(50))
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
