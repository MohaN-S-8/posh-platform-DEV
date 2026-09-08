from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db.base import Base


class AnnualReturn(Base):
    """One statutory PoSH annual return per company branch and year."""

    __tablename__ = "annual_returns"

    annual_return_id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("company_master.company_id"), nullable=False)
    branch_id = Column(String(80), nullable=False)
    branch_name = Column(String(150), nullable=False)
    year = Column(Integer, nullable=False)
    return_date = Column(Date, nullable=True)
    status = Column(String(30), default="Pending")
    presiding_officer = Column(String(150), nullable=True)
    complaints_received = Column(Integer, default=0)
    complaints_disposed = Column(Integer, default=0)
    complaints_pending_90 = Column(Integer, default=0)
    workshops_count = Column(Integer, default=0)
    action_taken = Column(Text, nullable=True)
    posh_office_recipient = Column(Text, nullable=True)
    acknowledgement_proof = Column(String(255), nullable=True)
    training_proof = Column(String(255), nullable=True)
    postal_proof = Column(String(255), nullable=True)
    sector_nature = Column(String(255), nullable=True)
    shift_breakdown = Column(Text, nullable=True)
    employees_total = Column(Integer, default=0)
    employees_male = Column(Integer, default=0)
    employees_female = Column(Integer, default=0)
    awareness_attendees = Column(Integer, default=0)
    pending_90_reasons = Column(Text, nullable=True)
    workshop_period_from = Column(Date, nullable=True)
    workshop_period_to = Column(Date, nullable=True)
    workshop_details = Column(Text, nullable=True)
    ic_constituted_date = Column(Date, nullable=True)
    ic_member_change = Column(String(255), nullable=True)
    orientation_programme_date = Column(Date, nullable=True)
    policy_disseminated = Column(String(255), nullable=True)
    notice_displayed_from = Column(Date, nullable=True)
    wfh_awareness_session_date = Column(Date, nullable=True)
    new_joiner_orientation_timing = Column(String(255), nullable=True)
    posh_awareness_date = Column(Date, nullable=True)
    posh_awareness_mode = Column(String(80), nullable=True)
    posh_awareness_resource_person = Column(String(150), nullable=True)
    ic_members_json = Column(Text, nullable=True)
    complaint_rows_json = Column(Text, nullable=True)
    annual_return_copy = Column(String(255), nullable=True)
    registered_post_tracking_number = Column(String(100), nullable=True)
    covering_from_address = Column(Text, nullable=True)
    posh_office_name = Column(String(150), nullable=True)
    posh_office_address = Column(Text, nullable=True)
    created_by = Column(BigInteger, nullable=True)
    updated_by = Column(BigInteger, nullable=True)
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
