import re
from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    mobile: str
    username: Optional[str] = None
    password: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    role_id: int
    company_id: int
    employee_id: str
    date_of_birth: Optional[date] = None
    father_name: Optional[str] = None
    emergency_contact: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    physically_challenged: Optional[str] = None
    marital_status: Optional[str] = None
    pan_number: Optional[str] = None
    foreign_national: Optional[str] = None
    joining_date: Optional[date] = None
    employment_status: Optional[str] = None
    employee_status: Optional[str] = None
    resignation_date: Optional[date] = None
    resignation_reason: Optional[str] = None
    reporting_to: Optional[str] = None
    branch_name: Optional[str] = None
    branch_id: Optional[str] = None
    transfer_date: Optional[date] = None
    transfer_location: Optional[str] = None
    transfer_branch_name: Optional[str] = None
    transfer_branch_id: Optional[str] = None
    ic_role: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        return v.strip().lower()

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        if not re.match(r"^\d{10}$", v.strip()):
            raise ValueError("Mobile must be exactly 10 digits")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not v:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 15:
            raise ValueError("Password must be at most 15 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserUpdate(BaseModel):
    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    role_id: Optional[int] = None
    date_of_birth: Optional[date] = None
    father_name: Optional[str] = None
    emergency_contact: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    physically_challenged: Optional[str] = None
    marital_status: Optional[str] = None
    pan_number: Optional[str] = None
    foreign_national: Optional[str] = None
    joining_date: Optional[date] = None
    employment_status: Optional[str] = None
    employee_status: Optional[str] = None
    resignation_date: Optional[date] = None
    resignation_reason: Optional[str] = None
    reporting_to: Optional[str] = None
    branch_name: Optional[str] = None
    branch_id: Optional[str] = None
    transfer_date: Optional[date] = None
    transfer_location: Optional[str] = None
    transfer_branch_name: Optional[str] = None
    transfer_branch_id: Optional[str] = None
    ic_role: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v is None:
            return v
        return v.strip().lower()

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        if v is None:
            return v
        if not re.match(r"^\d{10}$", v.strip()):
            raise ValueError("Mobile must be exactly 10 digits")
        return v.strip()


class UserResponse(BaseModel):
    user_id: int
    company_id: int
    employee_id: str
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str]
    email: str
    mobile: Optional[str]
    department: Optional[str]
    designation: Optional[str]
    role_id: int
    status: str
    date_of_birth: Optional[date] = None
    father_name: Optional[str] = None
    emergency_contact: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    physically_challenged: Optional[str] = None
    marital_status: Optional[str] = None
    pan_number: Optional[str] = None
    foreign_national: Optional[str] = None
    joining_date: Optional[date] = None
    employment_status: Optional[str] = None
    employee_status: Optional[str] = None
    resignation_date: Optional[date] = None
    resignation_reason: Optional[str] = None
    reporting_to: Optional[str] = None
    branch_name: Optional[str] = None
    branch_id: Optional[str] = None
    transfer_date: Optional[date] = None
    transfer_location: Optional[str] = None
    transfer_branch_name: Optional[str] = None
    transfer_branch_id: Optional[str] = None
    ic_role: Optional[str] = None

    class Config:
        from_attributes = True


class PasswordResetByAdmin(BaseModel):
    new_password: Optional[str] = None

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if not v:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 15:
            raise ValueError("Password must be at most 15 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")
        return v
