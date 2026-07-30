from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.schemas.admin_config import (
    AdminConfigResponse,
    MasterCodeCreate,
    MasterCodeResponse,
    MasterCodeUpdate,
    PoshOfficeCreate,
    PoshOfficeResponse,
    PoshOfficeUpdate,
    RoleAccessCreate,
    RoleAccessResponse,
    RoleAccessUpdate,
)

router = APIRouter(prefix="/admin-config", tags=["POSH Admin Configuration"])
SUPER_ADMIN_ROLES = [1]
ROLE_ACCESS_LABELS = {
    1: "Super Admin",
    2: "Company Admin",
    5: "Client Admin (Mgmt)",
    3: "HR",
    4: "Employee",
}
ROLE_ACCESS_ALIASES = {
    1: ["Super Admin"],
    2: ["Company Admin", "Corp Admin", "Admin"],
    5: ["Client Admin (Mgmt)", "Client / Management"],
    3: ["HR", "HR / IC", "PO / Member"],
    4: ["Employee"],
}


def _row_dict(row):
    if row is None:
        raise HTTPException(500, "Configuration was saved but could not be reloaded.")
    return dict(row._mapping)


@router.get("/my-role-access", response_model=list[RoleAccessResponse])
async def get_my_role_access(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role_label = ROLE_ACCESS_LABELS.get(current_user.role_id)
    if not role_label:
        return []
    for label in ROLE_ACCESS_ALIASES.get(current_user.role_id, [role_label]):
        result = await db.execute(
            text(
                """
                SELECT id, role_label, access_item, access_status, is_allowed, display_order
                FROM posh_role_access
                WHERE role_label = :role_label
                ORDER BY display_order, id
                """
            ),
            {"role_label": label},
        )
        rows = [_row_dict(row) for row in result]
        if rows:
            return rows
    return []


async def _ensure_exists(db: AsyncSession, table_name: str, record_id: int):
    result = await db.execute(
        text(f"SELECT id FROM {table_name} WHERE id = :id"),
        {"id": record_id},
    )
    if not result.first():
        raise HTTPException(404, "Configuration record not found.")


async def _duplicate_exists(db: AsyncSession, query: str, params: dict) -> bool:
    result = await db.execute(text(query), params)
    return result.first() is not None


@router.get("/", response_model=AdminConfigResponse)
async def get_admin_config(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    master_result = await db.execute(
        text(
            """
            SELECT id, category, name, code, description, is_active
            FROM posh_master_codes
            ORDER BY category, name
            """
        )
    )
    office_result = await db.execute(
        text(
            """
            SELECT id, office_name, office_address, is_active
            FROM posh_offices
            ORDER BY id
            """
        )
    )
    access_result = await db.execute(
        text(
            """
            SELECT id, role_label, access_item, access_status, is_allowed, display_order
            FROM posh_role_access
            ORDER BY role_label, display_order, id
            """
        )
    )
    return {
        "master_codes": [_row_dict(row) for row in master_result],
        "offices": [_row_dict(row) for row in office_result],
        "role_access": [_row_dict(row) for row in access_result],
    }


@router.post("/master-codes", response_model=MasterCodeResponse, status_code=201)
async def create_master_code(
    data: MasterCodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    data.code = data.code.strip().upper()
    if await _duplicate_exists(
        db,
        """
        SELECT id
        FROM posh_master_codes
        WHERE category = :category AND code = :code
        """,
        {"category": data.category, "code": data.code},
    ):
        raise HTTPException(400, f"{data.category} code '{data.code}' already exists.")
    insert_result = await db.execute(
        text(
            """
            INSERT INTO posh_master_codes (category, name, code, description, is_active)
            VALUES (:category, :name, :code, :description, :is_active)
            """
        ),
        data.model_dump(),
    )
    record_id = insert_result.lastrowid
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT id, category, name, code, description, is_active
            FROM posh_master_codes
            WHERE id = :id
            """
        ),
        {"id": record_id},
    )
    return _row_dict(result.first())


@router.put("/master-codes/{record_id}", response_model=MasterCodeResponse)
async def update_master_code(
    record_id: int,
    data: MasterCodeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    await _ensure_exists(db, "posh_master_codes", record_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        await db.execute(
            text(f"UPDATE posh_master_codes SET {field} = :value WHERE id = :id"),
            {"value": value, "id": record_id},
        )
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT id, category, name, code, description, is_active
            FROM posh_master_codes
            WHERE id = :id
            """
        ),
        {"id": record_id},
    )
    return _row_dict(result.first())


@router.delete("/master-codes/{record_id}")
async def delete_master_code(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    await _ensure_exists(db, "posh_master_codes", record_id)
    await db.execute(text("DELETE FROM posh_master_codes WHERE id = :id"), {"id": record_id})
    await db.commit()
    return {"message": "Master code deleted."}


@router.post("/offices", response_model=PoshOfficeResponse, status_code=201)
async def create_office(
    data: PoshOfficeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    data.office_name = data.office_name.strip().upper()
    if await _duplicate_exists(
        db,
        """
        SELECT id
        FROM posh_offices
        WHERE office_name = :office_name
        """,
        {"office_name": data.office_name},
    ):
        raise HTTPException(400, f"POSH office '{data.office_name}' already exists.")
    insert_result = await db.execute(
        text(
            """
            INSERT INTO posh_offices (office_name, office_address, is_active)
            VALUES (:office_name, :office_address, :is_active)
            """
        ),
        data.model_dump(),
    )
    record_id = insert_result.lastrowid
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT id, office_name, office_address, is_active
            FROM posh_offices
            WHERE id = :id
            """
        ),
        {"id": record_id},
    )
    return _row_dict(result.first())


@router.put("/offices/{record_id}", response_model=PoshOfficeResponse)
async def update_office(
    record_id: int,
    data: PoshOfficeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    await _ensure_exists(db, "posh_offices", record_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        await db.execute(
            text(f"UPDATE posh_offices SET {field} = :value WHERE id = :id"),
            {"value": value, "id": record_id},
        )
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT id, office_name, office_address, is_active
            FROM posh_offices
            WHERE id = :id
            """
        ),
        {"id": record_id},
    )
    return _row_dict(result.first())


@router.delete("/offices/{record_id}")
async def delete_office(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    await _ensure_exists(db, "posh_offices", record_id)
    await db.execute(text("DELETE FROM posh_offices WHERE id = :id"), {"id": record_id})
    await db.commit()
    return {"message": "Office deleted."}


@router.post("/role-access", response_model=RoleAccessResponse, status_code=201)
async def create_role_access(
    data: RoleAccessCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    if await _duplicate_exists(
        db,
        """
        SELECT id
        FROM posh_role_access
        WHERE role_label = :role_label AND access_item = :access_item
        """,
        {"role_label": data.role_label, "access_item": data.access_item},
    ):
        raise HTTPException(400, f"Access item already exists for {data.role_label}.")
    insert_result = await db.execute(
        text(
            """
            INSERT INTO posh_role_access
                (role_label, access_item, access_status, is_allowed, display_order)
            VALUES
                (:role_label, :access_item, :access_status, :is_allowed, :display_order)
            """
        ),
        data.model_dump(),
    )
    record_id = insert_result.lastrowid
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT id, role_label, access_item, access_status, is_allowed, display_order
            FROM posh_role_access
            WHERE id = :id
            """
        ),
        {"id": record_id},
    )
    return _row_dict(result.first())


@router.put("/role-access/{record_id}", response_model=RoleAccessResponse)
async def update_role_access(
    record_id: int,
    data: RoleAccessUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    await _ensure_exists(db, "posh_role_access", record_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        await db.execute(
            text(f"UPDATE posh_role_access SET {field} = :value WHERE id = :id"),
            {"value": value, "id": record_id},
        )
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT id, role_label, access_item, access_status, is_allowed, display_order
            FROM posh_role_access
            WHERE id = :id
            """
        ),
        {"id": record_id},
    )
    return _row_dict(result.first())


@router.delete("/role-access/{record_id}")
async def delete_role_access(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    await _ensure_exists(db, "posh_role_access", record_id)
    await db.execute(text("DELETE FROM posh_role_access WHERE id = :id"), {"id": record_id})
    await db.commit()
    return {"message": "Role access deleted."}
