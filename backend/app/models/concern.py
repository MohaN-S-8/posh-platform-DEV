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


class Concern(Base):
    """Concerns reported by portal users for admin review."""

    __tablename__ = "concerns"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    company_id = Column(Integer, ForeignKey("company_master.company_id"))
    category = Column(String(100))
    message = Column(Text)
    status = Column(Enum("Open", "Reviewed", "Closed"), default="Open")
    incident_date = Column(String(50))
    evidence_note = Column(String(500))
    stage = Column(Integer, default=1)
    notice_date = Column(String(50))
    enquiry_sessions_json = Column(Text)
    recommendation_text = Column(Text)
    recommendation_date = Column(String(50))
    recommendation_file = Column(String(255))
    execution_text = Column(Text)
    execution_date = Column(String(50))
    closure_note = Column(Text)
    closure_date = Column(String(50))
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
