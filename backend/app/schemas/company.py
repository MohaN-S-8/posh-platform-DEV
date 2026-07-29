import re
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class CompanyCreate(BaseModel):
    company_code: str
    company_name: str
    industry_type: str
    reference_no: Optional[str] = None
    company_type: str
    company_status_type: Optional[str] = None
    approval_status: Optional[str] = "Pending"
    client_id: Optional[str] = None
    scope_codes_json: Optional[str] = None
    service_details_json: Optional[str] = None
    referral_from: Optional[str] = None
    referral_name: Optional[str] = None
    website: Optional[str] = None
    registration_number: Optional[str] = None
    gst_number: Optional[str] = None
    employee_strength: Optional[int] = None
    address: Optional[str] = None
    corp_address_json: str
    billing_address_json: str
    account_contact_json: str
    coordinator_contact_json: str
    branches_json: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_mobile: Optional[str] = None

    @field_validator("company_name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Company name must be at least 2 characters")
        return v

    @field_validator(
        "company_code",
        "industry_type",
        "company_type",
        "corp_address_json",
        "billing_address_json",
        "account_contact_json",
        "coordinator_contact_json",
    )
    @classmethod
    def validate_required_text(cls, v):
        value = v.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("website")
    @classmethod
    def validate_website(cls, v):
        if not v:
            return v
        value = v.strip()
        if not re.match(r"^https?://[^\s]+\.[^\s]+$", value):
            raise ValueError("Website must be a valid http(s) URL")
        return value

    @field_validator("contact_mobile")
    @classmethod
    def validate_contact_mobile(cls, v):
        if not v:
            return v
        value = v.strip()
        if not re.match(r"^\d{4,15}$", value):
            raise ValueError("Contact number must be 4 to 15 digits")
        return value

    @field_validator("contact_person")
    @classmethod
    def validate_contact_person(cls, v):
        if not v:
            return v
        value = v.strip()
        if len(value) < 2:
            raise ValueError("Contact person must be at least 2 characters")
        return value


class CompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    industry_type: Optional[str] = None
    reference_no: Optional[str] = None
    company_type: Optional[str] = None
    company_status_type: Optional[str] = None
    approval_status: Optional[str] = None
    client_id: Optional[str] = None
    scope_codes_json: Optional[str] = None
    service_details_json: Optional[str] = None
    referral_from: Optional[str] = None
    referral_name: Optional[str] = None
    website: Optional[str] = None
    registration_number: Optional[str] = None
    gst_number: Optional[str] = None
    employee_strength: Optional[int] = None
    address: Optional[str] = None
    corp_address_json: Optional[str] = None
    billing_address_json: Optional[str] = None
    account_contact_json: Optional[str] = None
    coordinator_contact_json: Optional[str] = None
    branches_json: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_mobile: Optional[str] = None

    @field_validator("website")
    @classmethod
    def validate_website(cls, v):
        return CompanyCreate.validate_website(v)

    @field_validator("contact_mobile")
    @classmethod
    def validate_contact_mobile(cls, v):
        return CompanyCreate.validate_contact_mobile(v)

    @field_validator("contact_person")
    @classmethod
    def validate_contact_person(cls, v):
        return CompanyCreate.validate_contact_person(v)


class CompanyResponse(BaseModel):
    company_id: int
    company_code: str
    company_name: str
    industry_type: Optional[str]
    reference_no: Optional[str] = None
    company_type: Optional[str] = None
    company_status_type: Optional[str] = None
    approval_status: Optional[str] = None
    client_id: Optional[str] = None
    scope_codes_json: Optional[str] = None
    service_details_json: Optional[str] = None
    referral_from: Optional[str] = None
    referral_name: Optional[str] = None
    website: Optional[str]
    registration_number: Optional[str]
    gst_number: Optional[str]
    address: Optional[str]
    corp_address_json: Optional[str] = None
    billing_address_json: Optional[str] = None
    account_contact_json: Optional[str] = None
    coordinator_contact_json: Optional[str] = None
    branches_json: Optional[str] = None
    contact_person: Optional[str]
    status: str
    employee_strength: Optional[int]
    contact_email: Optional[str]
    contact_mobile: Optional[str]

    class Config:
        from_attributes = True


class CompanyLanguagePreference(BaseModel):
    language_id: int
    language_name: str
    enabled: bool
    is_default: bool = False


class CompanyLanguageUpdate(BaseModel):
    language_ids: list[int]
    default_language_id: Optional[int] = None
