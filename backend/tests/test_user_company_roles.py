import pytest
from fastapi import HTTPException

from app.api.v1.users import _ensure_company_role


@pytest.mark.parametrize("company_id", [2, 10])
@pytest.mark.parametrize("role_id", [1, 2])
def test_external_company_rejects_portal_admin_roles(company_id, role_id):
    with pytest.raises(HTTPException) as error:
        _ensure_company_role(company_id, role_id)
    assert error.value.status_code == 422


@pytest.mark.parametrize("role_id", [3, 4, 5])
def test_external_company_accepts_client_ic_employee(role_id):
    _ensure_company_role(2, role_id)


@pytest.mark.parametrize("role_id", [1, 2, 3, 4, 5])
def test_default_company_preserves_role_choices(role_id):
    _ensure_company_role(1, role_id)
