import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.input_validation import person_name


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    confirm_password: str
    mobile: str

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("First name must be at least 2 characters")
        if len(v) > 50:
            raise ValueError("First name must be at most 50 characters")
        return person_name(v)

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, v):
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Last name is required")
        if len(v) > 50:
            raise ValueError("Last name must be at most 50 characters")
        return person_name(v)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        v = v.strip().lower()
        if len(v) > 25:
            raise ValueError("Email must be at most 25 characters")
        return v

    @field_validator("password")
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

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        v = v.strip()
        if not re.match(r"^\d{10}$", v):
            raise ValueError("Mobile must be exactly 10 digits")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Confirm password is required")
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^[0-9]{6}$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        v = v.strip().lower()
        if len(v) > 25:
            raise ValueError("Email must be at most 25 characters")
        return v

    @field_validator("password")
    @classmethod
    def validate_login_password(cls, v):
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value):
        return SignupRequest.validate_password(value)

    @field_validator("confirm_password")
    @classmethod
    def confirm(cls, value, info):
        if "new_password" in info.data and value != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return value


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        return SignupRequest.validate_password(v)

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role_id: int
    company_id: int
    permissions: list[str] = Field(default_factory=list)
