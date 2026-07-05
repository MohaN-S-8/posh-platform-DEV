from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.base import Base


class Notification(Base):
    """System notifications sent to users (training reminders, overdue alerts)."""

    __tablename__ = "notification"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    title = Column(String(200))
    message = Column(String(500))
    is_read = Column(Boolean, default=False)
    created_date = Column(DateTime, server_default=func.now())
