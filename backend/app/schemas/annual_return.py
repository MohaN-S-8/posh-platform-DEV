import json
from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, TypeAdapter, field_validator, model_validator

from app.schemas.input_validation import person_name, phone


class AnnualReturnFields(BaseModel):
    company_id: int
    branch_id: str = Field(min_length=1, max_length=80)
    branch_name: str = Field(min_length=1, max_length=150)
    year: int = Field(ge=2013, le=2100)
    return_date: Optional[date] = None
    status: str = "Pending"
    presiding_officer: Optional[str] = None
    complaints_received: int = Field(default=0, ge=0)
    complaints_disposed: int = Field(default=0, ge=0)
    complaints_pending_90: int = Field(default=0, ge=0)
    workshops_count: int = Field(default=0, ge=0)
    action_taken: Optional[str] = None
    posh_office_recipient: Optional[str] = None
    acknowledgement_proof: Optional[str] = None
    training_proof: Optional[str] = None
    postal_proof: Optional[str] = None
    sector_nature: Optional[str] = None
    shift_breakdown: Optional[str] = None
    employees_total: int = Field(default=0, ge=0)
    employees_male: int = Field(default=0, ge=0)
    employees_female: int = Field(default=0, ge=0)
    awareness_attendees: int = Field(default=0, ge=0)
    pending_90_reasons: Optional[str] = None
    workshop_period_from: Optional[date] = None
    workshop_period_to: Optional[date] = None
    workshop_details: Optional[str] = None
    ic_constituted_date: Optional[date] = None
    ic_member_change: Optional[str] = None
    orientation_programme_date: Optional[date] = None
    policy_disseminated: Optional[str] = None
    notice_displayed_from: Optional[date] = None
    wfh_awareness_session_date: Optional[date] = None
    new_joiner_orientation_timing: Optional[str] = None
    posh_awareness_date: Optional[date] = None
    posh_awareness_mode: Optional[str] = None
    posh_awareness_resource_person: Optional[str] = None
    ic_members_json: Optional[str] = None
    complaint_rows_json: Optional[str] = None
    annual_return_copy: Optional[str] = None
    registered_post_tracking_number: Optional[str] = None
    covering_from_address: Optional[str] = None
    posh_office_name: Optional[str] = None
    posh_office_address: Optional[str] = None


class AnnualReturnPayload(AnnualReturnFields):
    @field_validator("presiding_officer", "posh_awareness_resource_person")
    @classmethod
    def names(cls, value):
        return person_name(value)

    @field_validator("status")
    @classmethod
    def status_choice(cls, value):
        if value not in {"Pending", "Draft", "Submitted"}:
            raise ValueError("Status must be Pending, Draft or Submitted")
        return value

    @field_validator("ic_members_json", "complaint_rows_json")
    @classmethod
    def rows(cls, value, info):
        if not value:
            return value
        try:
            rows = json.loads(value)
        except (ValueError, TypeError):
            raise ValueError("Rows must be valid JSON")
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError("Rows must be a list of objects")
        if info.field_name == "ic_members_json":
            for row in rows:
                if row.get("name"):
                    person_name(row["name"])
                if row.get("email"):
                    TypeAdapter(EmailStr).validate_python(row["email"])
                if row.get("contact_no"):
                    phone(row["contact_no"])
        return value

    @model_validator(mode="after")
    def period(self):
        if (
            self.workshop_period_from
            and self.workshop_period_to
            and self.workshop_period_to < self.workshop_period_from
        ):
            raise ValueError("Workshop period end cannot be before its start")
        return self


class AnnualReturnResponse(AnnualReturnFields):
    annual_return_id: Optional[int] = None
    company_name: Optional[str] = None
    company_code: Optional[str] = None

    class Config:
        from_attributes = True
