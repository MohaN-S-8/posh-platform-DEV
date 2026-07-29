from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.base import Base


class PoshPolicy(Base):
    __tablename__ = "posh_policy"

    policy_id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(Integer, nullable=True, unique=True)
    title = Column(String(200), default="Prevention, prohibition, and redressal at work.")
    overview = Column(Text)
    version = Column(String(50), default="3.2")
    approved_date = Column(String(50), default="04 Jan 2026")
    document_path = Column(String(500), nullable=True)
    document_name = Column(String(255), nullable=True)
    harassment_types_json = Column(Text)
    committee_members_json = Column(Text)
    rights_json = Column(Text)
    faqs_json = Column(Text)
    updated_by = Column(BigInteger, nullable=True)
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
