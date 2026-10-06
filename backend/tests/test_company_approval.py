from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.services.company_service import CompanyService


@pytest.mark.asyncio
async def test_approval_reports_assignment_and_policy_blockers_together():
    service = CompanyService()
    company = SimpleNamespace(service_details_json='[{"scope":"POSH"}]', approval_status="Pending")
    service.get_by_id = AsyncMock(return_value=company)
    service._missing_registration_fields = lambda _: ["PoSH policy PDF"]
    service._send_assignment_emails = AsyncMock()
    db = AsyncMock()
    with pytest.raises(HTTPException) as error:
        await service.approve(db, 4)
    assert error.value.status_code == 400
    assert "Assign every work-order service" in error.value.detail
    assert "PoSH policy PDF" in error.value.detail
    assert company.approval_status == "Pending"
    db.commit.assert_not_awaited()
    service._send_assignment_emails.assert_not_awaited()


@pytest.mark.asyncio
async def test_complete_company_can_be_approved():
    service = CompanyService()
    company = SimpleNamespace(
        company_id=4,
        service_details_json='[{"scope":"POSH","assigned_to":2}]',
        approval_status="Pending",
    )
    service.get_by_id = AsyncMock(return_value=company)
    service._missing_registration_fields = lambda _: []
    service._send_assignment_emails = AsyncMock(return_value={"sent": 1})
    db = AsyncMock()
    response = await service.approve(db, 4)
    assert response["approval_status"] == "Approved"
    db.commit.assert_awaited_once()
    service._send_assignment_emails.assert_awaited_once_with(db, company)
