from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.sql import func

from app.db.base import Base


class CompanyMaster(Base):
    __tablename__ = "company_master"

    company_id = Column(Integer, primary_key=True, autoincrement=True)
    company_code = Column(String(20), unique=True)
    company_name = Column(String(200))
    industry_type = Column(String(100))
    reference_no = Column(String(50))
    company_type = Column(String(100))
    company_status_type = Column(String(50))
    approval_status = Column(String(30), default="Pending")
    client_id = Column(String(100))
    scope_codes_json = Column(Text)
    service_details_json = Column(Text)
    referral_from = Column(String(100))
    referral_name = Column(String(150))
    website = Column(String(200))
    registration_number = Column(String(50))
    gst_number = Column(String(50))
    employee_strength = Column(Integer)
    address = Column(Text)
    corp_address_json = Column(Text)
    billing_address_json = Column(Text)
    account_contact_json = Column(Text)
    coordinator_contact_json = Column(Text)
    branches_json = Column(Text)
    contact_person = Column(String(100))
    contact_email = Column(String(100))
    contact_mobile = Column(String(20))
    status = Column(Enum("Active", "Inactive"), default="Active")
    is_deleted = Column(String(1), default="N")  # soft delete
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
