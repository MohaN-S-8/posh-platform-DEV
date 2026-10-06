import json
import re
import unicodedata
from datetime import date

from pydantic import BaseModel, EmailStr, TypeAdapter, field_validator, model_validator


def person_name(value):
    if value is None or value == "":
        return value
    if not isinstance(value, str):
        raise ValueError("Name must be text")
    value = value.strip()
    if not any(char.isalpha() for char in value) or any(
        not (unicodedata.category(char)[0] in "LM" or char in " .'-\u2019") for char in value
    ):
        raise ValueError(
            "Use letters, spaces, initials, apostrophes or hyphens for a person's name"
        )
    return value


def phone(value):
    if value is None or value == "":
        return value
    if not isinstance(value, str):
        raise ValueError("Contact number must be text containing digits")
    value = value.strip()
    if not re.fullmatch(r"[0-9]{10}", value):
        raise ValueError("Contact number must contain exactly 10 digits")
    return value


class PersonInput(BaseModel):
    @field_validator("email", check_fields=False)
    @classmethod
    def email_length(cls, value):
        if value and len(value) > 100:
            raise ValueError("Email must contain no more than 100 characters")
        return value

    @field_validator("company_id", "role_id", check_fields=False)
    @classmethod
    def positive_id(cls, value):
        if value is not None and value < 1:
            raise ValueError("Select a valid company or role")
        return value

    @field_validator("first_name", "last_name", "father_name", check_fields=False)
    @classmethod
    def names(cls, value, info):
        result = person_name(value)
        if info.field_name == "first_name" and not result:
            raise ValueError("First name is required")
        if result and len(result) > (150 if info.field_name == "father_name" else 100):
            raise ValueError("Name is too long")
        return result

    @field_validator("emergency_contact", check_fields=False)
    @classmethod
    def emergency_phone(cls, value):
        return phone(value)

    @field_validator("pan_number", check_fields=False)
    @classmethod
    def pan(cls, value):
        if value:
            value = value.strip().upper()
            if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", value):
                raise ValueError("PAN must contain 5 letters, 4 digits and 1 letter")
        return value

    @field_validator("employee_id", "username", "department", "designation", check_fields=False)
    @classmethod
    def bounded_text(cls, value, info):
        if value is None:
            return value
        value = value.strip()
        limit = 30 if info.field_name == "employee_id" else 100
        if len(value) > limit or (info.field_name in {"employee_id", "username"} and not value):
            raise ValueError(f"{info.field_name} must contain 1 to {limit} characters")
        if info.field_name in {"employee_id", "username"} and not re.fullmatch(
            r"[A-Za-z0-9@._/-]+", value
        ):
            raise ValueError("Use letters, digits, @, dot, underscore, slash or hyphen")
        return value

    @field_validator(
        "physically_challenged",
        "foreign_national",
        "marital_status",
        "employment_status",
        "employee_status",
        check_fields=False,
    )
    @classmethod
    def choices(cls, value, info):
        allowed = {
            "physically_challenged": {"Yes", "No"},
            "foreign_national": {"Yes", "No"},
            "marital_status": {"Single", "Married"},
            "employment_status": {"Permanent", "Temporary"},
            "employee_status": {"Employed", "Unemployed"},
        }
        if value and value not in allowed[info.field_name]:
            raise ValueError("Select one of: " + ", ".join(sorted(allowed[info.field_name])))
        return value

    @model_validator(mode="after")
    def dates(self):
        birth = getattr(self, "date_of_birth", None)
        joined = getattr(self, "joining_date", None)
        resigned = getattr(self, "resignation_date", None)
        if birth and birth >= date.today():
            raise ValueError("Date of birth must be in the past")
        if birth and joined and joined <= birth:
            raise ValueError("Joining date must be after date of birth")
        if joined and resigned and resigned < joined:
            raise ValueError("Resignation date cannot be before joining date")
        return self


class CompanyInput(BaseModel):
    @field_validator("employee_strength", check_fields=False)
    @classmethod
    def strength(cls, value):
        if value is not None and value < 0:
            raise ValueError("Employee strength cannot be negative")
        return value

    @field_validator(
        "corp_address_json",
        "billing_address_json",
        "account_contact_json",
        "coordinator_contact_json",
        check_fields=False,
    )
    @classmethod
    def nested_details(cls, value, info):
        if not value:
            return value
        try:
            obj = json.loads(value)
        except (ValueError, TypeError):
            raise ValueError("Details must be valid JSON")
        if not isinstance(obj, dict):
            raise ValueError("Details must be an object")
        if "contact" in info.field_name:
            if obj.get("name"):
                obj["name"] = person_name(obj["name"])
            if obj.get("contact_no"):
                obj["contact_no"] = phone(obj["contact_no"])
            if obj.get("email"):
                obj["email"] = str(TypeAdapter(EmailStr).validate_python(obj["email"]))
        elif obj.get("pincode") and not re.fullmatch(r"[0-9]{6}", str(obj["pincode"])):
            raise ValueError("Pincode must contain exactly 6 digits")
        return json.dumps(obj)
