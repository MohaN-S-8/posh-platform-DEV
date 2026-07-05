import re
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    mobile: str
    department: Optional[str] = None
    designation: Optional[str] = None
    role_id: int
    company_id: int
    employee_id: str

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


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    role_id: Optional[int] = None


class UserResponse(BaseModel):
    user_id: int
    company_id: int
    employee_id: str
    first_name: str
    last_name: Optional[str]
    email: str
    mobile: Optional[str]
    department: Optional[str]
    designation: Optional[str]
    role_id: int
    status: str

    class Config:
        from_attributes = True


class PasswordResetByAdmin(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
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
