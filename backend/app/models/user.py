from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.sql import func

from app.db.base import Base


class UserMaster(Base):
    __tablename__ = "user_master"

    user_id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("company_master.company_id"), nullable=False)
    employee_id = Column(String(30), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100))
    email = Column(String(100), unique=True, nullable=False)
    mobile = Column(String(20))
    father_name = Column(String(150))
    emergency_contact = Column(String(20))
    gender = Column(String(20))
    blood_group = Column(String(10))
    physically_challenged = Column(String(10))
    marital_status = Column(String(20))
    pan_number = Column(String(20))
    foreign_national = Column(String(10))
    department = Column(String(100))
    designation = Column(String(100))
    employment_status = Column(String(50))
    employee_status = Column(String(50))
    resignation_date = Column(Date)
    resignation_reason = Column(String(255))
    reporting_to = Column(String(150))
    branch_name = Column(String(150))
    branch_id = Column(String(50))
    transfer_date = Column(Date)
    transfer_location = Column(String(150))
    transfer_branch_name = Column(String(150))
    transfer_branch_id = Column(String(50))
    ic_role = Column(String(100))
    role_id = Column(Integer, ForeignKey("role_master.role_id"), nullable=False)
    manager_id = Column(BigInteger, ForeignKey("user_master.user_id"), nullable=True)
    login_type = Column(Enum("Email", "SSO", "Entra ID"), default="Email")
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255))
    language_preference = Column(Integer)
    status = Column(Enum("Active", "Inactive"), default="Active")
    is_deleted = Column(String(1), default="N")  # soft delete
    date_of_birth = Column(Date)
    joining_date = Column(Date)
    created_date = Column(DateTime, server_default=func.now())
    updated_date = Column(DateTime, server_default=func.now(), onupdate=func.now())
