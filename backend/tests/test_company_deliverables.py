import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.company_deliverables import (
    company_features,
    enforce_company_deliverable,
    request_feature,
    restrict_role_records,
    selected_codes,
)
from app.services.company_service import CompanyService


def database(codes):
    company = MagicMock()
    company.first.return_value = (json.dumps([{"scope": "POSH", "deliverable_codes": codes}]),)
    masters = MagicMock()
    masters.mappings.return_value = [
        {"code": "POLICY", "name": "PoSH Policy"},
        {"code": "TRAINING", "name": "Awareness Training"},
        {"code": "CERTIFICATE", "name": "Assessment & Certificates"},
    ]
    return AsyncMock(execute=AsyncMock(side_effect=[company, masters]))


@pytest.mark.parametrize(
    "value,expected",
    [
        ('[{"scope":"POSH","deliverables":"Legacy"}]', None),
        ('[{"scope":"POSH","deliverable_codes":["POLICY"]}]', {"POLICY"}),
        ('[{"scope":"POSH","deliverable_codes":"POLICY"}]', set()),
        ("not json", set()),
    ],
)
def test_selection_parsing(value, expected):
    assert selected_codes(value) == expected


@pytest.mark.parametrize(
    "path,expected",
    [
        ("/api/v1/videos/42/stream", "training"),
        ("/api/v1/employee/summary", "training"),
        ("/api/v1/assessments/42", "certificate"),
        ("/api/v1/annual-returns/", "annual"),
        ("/api/v1/analytics/current", "reports"),
        ("/api/v1/concerns/42", "complaints"),
        ("/api/v1/auth/me", None),
    ],
)
def test_endpoint_mapping(path, expected):
    assert request_feature(path) == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [3, 4, 5])
async def test_tenant_roles_cannot_access_unselected_training(role):
    db = database(["POLICY"])
    user = SimpleNamespace(role_id=role, company_id=7)
    with pytest.raises(HTTPException) as error:
        await enforce_company_deliverable(db, user, "/api/v1/videos/published")
    assert error.value.status_code == 403
    query = db.execute.call_args_list[0].args[0]
    assert query.compile().params["company_id_1"] == 7


@pytest.mark.asyncio
async def test_selected_training_access_and_unknown_codes():
    user = SimpleNamespace(role_id=4, company_id=7)
    await enforce_company_deliverable(database(["TRAINING"]), user, "/api/v1/videos/published")
    assert await company_features(database(["UNKNOWN"]), user) == set()


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [1, 2])
async def test_platform_oversight_unchanged(role):
    db = AsyncMock()
    await enforce_company_deliverable(db, SimpleNamespace(role_id=role), "/api/v1/videos")
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_company_selection_only_restricts_role_matrix():
    rows = [
        {"access_item": "PoSH Policy", "is_allowed": False},
        {"access_item": "PoSH Training", "is_allowed": True},
        {"access_item": "User Master", "is_allowed": True},
    ]
    result = await restrict_role_records(
        database(["POLICY"]), SimpleNamespace(role_id=5, company_id=7), rows
    )
    permissions = {row["access_item"]: row["is_allowed"] for row in result}
    assert permissions["PoSH Policy"] is False
    assert permissions["PoSH Training"] is False
    assert permissions["User Master"] is True
    assert permissions["Annual Returns"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("codes", [[], ["UNKNOWN"], ["TRAINING"], ["CERTIFICATE"]])
async def test_invalid_or_incomplete_selections_are_rejected(codes):
    service = CompanyService()
    service._next_client_sequence = AsyncMock(return_value=1)
    db = database([])
    await db.execute()  # Consume the company result; normalization reads only masters.
    with pytest.raises(HTTPException) as error:
        await service._normalize_service_details(
            db,
            {
                "company_code": "ACME",
                "service_details_json": json.dumps([{"scope": "POSH", "deliverable_codes": codes}]),
            },
        )
    assert error.value.status_code == 422


@pytest.mark.asyncio
async def test_selected_master_codes_and_labels_are_saved():
    service = CompanyService()
    service._next_client_sequence = AsyncMock(return_value=1)
    db = database([])
    await db.execute()
    result = await service._normalize_service_details(
        db,
        {
            "company_code": "ACME",
            "service_details_json": json.dumps(
                [{"scope": "POSH", "deliverable_codes": ["POLICY", "TRAINING", "POLICY"]}]
            ),
        },
    )
    row = json.loads(result["service_details_json"])[0]
    assert row["deliverable_codes"] == ["POLICY", "TRAINING"]
    assert row["deliverables"] == "PoSH Policy, Awareness Training"
