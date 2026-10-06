import json

import pytest
from pydantic import ValidationError

from app.schemas.annual_return import AnnualReturnPayload
from app.schemas.auth import OTPVerifyRequest
from app.schemas.company import CompanyUpdate, EmployeeMasterCreate
from app.schemas.hr import TrainingAssignRequest
from app.schemas.user import UserCreate, UserUpdate


@pytest.mark.parametrize(
    "values",
    [
        {"first_name": "John123"},
        {"first_name": "   "},
        {"mobile": "12345abc90"},
        {"emergency_contact": "123"},
        {"email": "bad@email@host"},
        {"pan_number": "INVALID"},
        {"marital_status": "invalid"},
        {"date_of_birth": "2100-01-01"},
        {"employee_id": "BAD ID"},
    ],
)
def test_invalid_user_fields_on_create_and_update(values):
    with pytest.raises(ValidationError):
        UserCreate(
            first_name=values.get("first_name", "John"),
            last_name="Smith",
            email=values.get("email", "john@example.com"),
            mobile=values.get("mobile", "9876543210"),
            employee_id=values.get("employee_id", "EMP-1"),
            company_id=1,
            role_id=4,
            **{
                key: value
                for key, value in values.items()
                if key not in {"first_name", "email", "mobile", "employee_id"}
            },
        )
    with pytest.raises(ValidationError):
        UserUpdate(**values)


@pytest.mark.parametrize(
    "name", ["Anne-Marie", "O'Connor", "R. Kumar", "\u0bae\u0bcb\u0b95\u0ba9\u0bcd"]
)
def test_valid_person_names(name):
    assert UserUpdate(first_name=name).first_name == name


@pytest.mark.parametrize(
    "field,value",
    [
        ("account_contact_json", {"email": "broken"}),
        ("coordinator_contact_json", {"name": "Name123"}),
        ("account_contact_json", {"contact_no": "abcd"}),
        ("corp_address_json", {"pincode": "123abc"}),
    ],
)
def test_company_nested_validation(field, value):
    with pytest.raises(ValidationError):
        CompanyUpdate(**{field: json.dumps(value)})


def test_numbers_and_nested_annual_contacts():
    with pytest.raises(ValidationError):
        CompanyUpdate(employee_strength=-1)
    with pytest.raises(ValidationError):
        OTPVerifyRequest(email="a@example.com", otp="abc123")
    with pytest.raises(ValidationError):
        TrainingAssignRequest(video_id=1, assign_type="Company-Wide", passing_score=101)
    with pytest.raises(ValidationError):
        AnnualReturnPayload(
            company_id=1,
            branch_id="BR1",
            branch_name="Main",
            year=2026,
            ic_members_json='[{"email":"invalid"}]',
        )
    with pytest.raises(ValidationError):
        EmployeeMasterCreate(
            company_id=1,
            employee_id="EMP1",
            first_name="Name123",
            email="a@example.com",
            mobile="9876543210",
        )
