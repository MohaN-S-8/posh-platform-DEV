from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1.branding import BrandingInput, get_branding, update_branding
from app.core.config import settings


@pytest.mark.asyncio
async def test_primary_updates_persisted_default_company():
    company = SimpleNamespace(company_name="Old Portal")
    db = SimpleNamespace(get=AsyncMock(return_value=company), commit=AsyncMock())
    user = SimpleNamespace(role_id=1, user_id=settings.PRIMARY_SUPER_ADMIN_USER_ID)
    assert await update_branding(BrandingInput(portal_name="New Portal"), db, user) == {
        "portal_name": "New Portal"
    }
    db.commit.assert_awaited_once()
    assert await get_branding(db) == {"portal_name": "New Portal"}


@pytest.mark.asyncio
@pytest.mark.parametrize("role,user_id", [(1, 9999), (2, 1), (5, 1), (3, 1), (4, 1)])
async def test_other_users_cannot_rename(role, user_id):
    db = SimpleNamespace(get=AsyncMock(), commit=AsyncMock())
    with pytest.raises(HTTPException) as error:
        await update_branding(
            BrandingInput(portal_name="New Portal"),
            db,
            SimpleNamespace(role_id=role, user_id=user_id),
        )
    assert error.value.status_code == 403
    db.commit.assert_not_awaited()


@pytest.mark.parametrize("name", [" ", "A", "<script>bad</script>", "x" * 101, "---"])
def test_invalid_names(name):
    with pytest.raises(ValidationError):
        BrandingInput(portal_name=name)
