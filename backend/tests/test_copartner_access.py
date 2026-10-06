from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.api.v1.admin_config import create_role_access
from app.core.config import settings
from app.core.dependencies import matrix_role, require_permission, require_roles_with_matrix
from app.core.role_matrix import SEED_COPARTNER
from app.schemas.admin_config import RoleAccessCreate


class DB:
    def __init__(self, session):
        self.session = session

    async def execute(self, query, params=None):
        return self.session.execute(query, params or {})


@pytest.mark.asyncio
async def test_independent_permissions_and_idempotent_seed():
    engine = create_engine("sqlite://")
    with Session(engine) as session:
        session.execute(
            text(
                "CREATE TABLE posh_role_access (id INTEGER PRIMARY KEY, role_label TEXT, access_item TEXT, access_status TEXT, is_allowed BOOLEAN, display_order INTEGER)"
            )
        )
        session.execute(
            text(
                "INSERT INTO posh_role_access VALUES (1, 'Super Admin', 'PoSH Training', 'Access enabled', 1, 1)"
            )
        )
        session.execute(SEED_COPARTNER)
        session.execute(
            text("UPDATE posh_role_access SET is_allowed=0 WHERE role_label='Co-Partner'")
        )
        session.execute(SEED_COPARTNER)
        assert session.execute(text("SELECT count(*) FROM posh_role_access")).scalar() == 2
        db = DB(session)
        primary = SimpleNamespace(role_id=1, user_id=settings.PRIMARY_SUPER_ADMIN_USER_ID)
        partner = SimpleNamespace(role_id=1, user_id=settings.PRIMARY_SUPER_ADMIN_USER_ID + 1)
        assert matrix_role(primary) == 1
        assert matrix_role(partner) == "Co-Partner"
        check = require_roles_with_matrix([1], ["PoSH Training"])
        assert await check(primary, db) is primary
        with pytest.raises(HTTPException) as error:
            await check(partner, db)
        assert error.value.status_code == 403
        with pytest.raises(HTTPException):
            await require_permission("videos.upload")(partner, db)
        assert await require_permission("videos.upload")(primary, db) is primary


@pytest.mark.asyncio
async def test_partner_cannot_modify_primary_matrix():
    with pytest.raises(HTTPException) as error:
        await create_role_access(
            RoleAccessCreate(role_label="Super Admin", access_item="Home"),
            AsyncMock(),
            SimpleNamespace(role_id=1, user_id=settings.PRIMARY_SUPER_ADMIN_USER_ID + 1),
        )
    assert error.value.status_code == 403
