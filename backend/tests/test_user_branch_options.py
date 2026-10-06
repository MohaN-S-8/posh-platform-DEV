import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1 import users


@pytest.mark.asyncio
async def test_client_cannot_fetch_other_company_branches(monkeypatch):
    lookup = AsyncMock()
    monkeypatch.setattr(users.company_service, "get_by_id", lookup)
    with pytest.raises(HTTPException) as error:
        await users.user_branch_options(3, AsyncMock(), SimpleNamespace(role_id=5, company_id=2))
    assert error.value.status_code == 403
    lookup.assert_not_awaited()


@pytest.mark.asyncio
async def test_branch_options_only_return_workplace_fields(monkeypatch):
    company = SimpleNamespace(
        branches_json=json.dumps(
            [
                {
                    "branch_id": "BR1",
                    "branch_name": "Main",
                    "city": "Chennai",
                    "state": "TN",
                    "address1": "Office",
                    "ic_member_ids": ["PRIVATE"],
                }
            ]
        )
    )
    monkeypatch.setattr(users.company_service, "get_by_id", AsyncMock(return_value=company))
    rows = await users.user_branch_options(2, AsyncMock(), SimpleNamespace(role_id=5, company_id=2))
    assert rows[0]["branch_id"] == "BR1"
    assert rows[0]["city"] == "Chennai"
    assert "ic_member_ids" not in rows[0]


@pytest.mark.asyncio
async def test_admin_branch_lookup_obeys_company_visibility(monkeypatch):
    monkeypatch.setattr(
        users.company_service,
        "get_visible_for_user",
        AsyncMock(return_value=[SimpleNamespace(company_id=2)]),
    )
    monkeypatch.setattr(
        users.company_service,
        "get_by_id",
        AsyncMock(return_value=SimpleNamespace(branches_json="[]")),
    )
    user = SimpleNamespace(role_id=2, company_id=1)
    assert await users.user_branch_options(2, AsyncMock(), user) == []
    with pytest.raises(HTTPException):
        await users.user_branch_options(3, AsyncMock(), user)


@pytest.mark.asyncio
@pytest.mark.parametrize("raw", ["broken", "{}", '["invalid"]'])
async def test_malformed_branch_data_returns_clear_error(monkeypatch, raw):
    monkeypatch.setattr(
        users.company_service,
        "get_by_id",
        AsyncMock(return_value=SimpleNamespace(branches_json=raw)),
    )
    with pytest.raises(HTTPException) as error:
        await users.user_branch_options(2, AsyncMock(), SimpleNamespace(role_id=1))
    assert error.value.status_code == 409
