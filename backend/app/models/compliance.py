from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.db.base import Base


class ExternalMember(Base):
    __tablename__ = "posh_external_members"
    __table_args__ = (UniqueConstraint("company_id", "email", name="uq_external_member_email"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer, ForeignKey("company_master.company_id"), nullable=False, index=True
    )
    name = Column(String(150), nullable=False)
    organization = Column(String(200), nullable=False, default="")
    designation = Column(String(150), nullable=False)
    location = Column(String(150), nullable=False, default="")
    contact = Column(String(25), nullable=False, default="")
    email = Column(String(254), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class ConstitutionLetter(Base):
    __tablename__ = "posh_constitution_letters"
    __table_args__ = (
        CheckConstraint("status IN ('Pending', 'Completed')", name="ck_constitution_status"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer, ForeignKey("company_master.company_id"), nullable=False, index=True
    )
    member_id = Column(
        Integer, ForeignKey("posh_external_members.id", ondelete="RESTRICT"), nullable=False
    )
    title = Column(String(200), nullable=False, default="")
    filename = Column(String(200), nullable=False)
    object_key = Column(String(500), nullable=False)
    approver_name = Column(String(150), nullable=False)
    approver_email = Column(String(254), nullable=False)
    status = Column(String(20), nullable=False, default="Pending")
    delivery_status = Column(String(20), nullable=False, default="Pending")
    token_hash = Column(String(64), unique=True, nullable=True)
    token_expires_at = Column(DateTime, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    submitted_by = Column(Integer, nullable=False)
    submitted_at = Column(DateTime, nullable=False, server_default=func.now())


class NoticeDisplay(Base):
    __tablename__ = "posh_notice_displays"
    __table_args__ = (
        UniqueConstraint("company_id", "branch_id", name="uq_notice_company_branch"),
        CheckConstraint("status IN ('Pending', 'Completed')", name="ck_notice_status"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer, ForeignKey("company_master.company_id"), nullable=False, index=True
    )
    branch_id = Column(String(50), nullable=False)
    branch_name = Column(String(150), nullable=False)
    status = Column(String(20), nullable=False)
    notes = Column(String(2000), nullable=False, default="")
    updated_by = Column(Integer, nullable=False)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class QuarterlyMeeting(Base):
    __tablename__ = "posh_quarterly_meetings"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "branch_id", "year", "quarter", name="uq_meeting_branch_quarter"
        ),
        CheckConstraint("quarter BETWEEN 1 AND 4", name="ck_meeting_quarter"),
        CheckConstraint("year BETWEEN 2000 AND 2100", name="ck_meeting_year"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer, ForeignKey("company_master.company_id"), nullable=False, index=True
    )
    branch_id = Column(String(50), nullable=False)
    branch_name = Column(String(150), nullable=False)
    year = Column(Integer, nullable=False)
    quarter = Column(Integer, nullable=False)
    meeting_date = Column(Date, nullable=False)
    meeting_time = Column(Time, nullable=False)
    presiding_officer = Column(String(150), nullable=False)
    venue = Column(String(500), nullable=False)
    attendees = Column(String(4000), nullable=False)
    agenda1 = Column(Text, nullable=False, default="")
    agenda2 = Column(Text, nullable=False, default="")
    agenda3 = Column(Text, nullable=False, default="")
    agenda4 = Column(Text, nullable=False, default="")
    agenda5 = Column(Text, nullable=False, default="")
    photo_key = Column(String(500), nullable=True)
    signed_key = Column(String(500), nullable=True)
    signed_filename = Column(String(200), nullable=True)
    created_by = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
