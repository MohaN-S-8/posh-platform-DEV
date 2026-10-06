from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.company import CompanyMaster

router = APIRouter(prefix="/branding", tags=["Portal Settings"])


class BrandingInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    portal_name: str = Field(min_length=2, max_length=100)

    @field_validator("portal_name")
    @classmethod
    def valid_name(cls, value):
        if not any(char.isalnum() for char in value) or any(
            ord(char) < 32 or char in "<>" for char in value
        ):
            raise ValueError("Enter a valid portal name without markup or control characters")
        return value


def is_primary(user):
    return user.role_id == 1 and user.user_id == settings.PRIMARY_SUPER_ADMIN_USER_ID


@router.get("")
async def get_branding(db: AsyncSession = Depends(get_db)):
    company = await db.get(CompanyMaster, 1)
    return {"portal_name": company.company_name if company else "XYZ Portal"}


@router.get("/access")
async def branding_access(user=Depends(get_current_user)):
    return {"can_edit": is_primary(user)}


@router.put("")
async def update_branding(
    data: BrandingInput, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    if not is_primary(user):
        raise HTTPException(403, "Only the primary Super Admin can change the portal name")
    company = await db.get(CompanyMaster, 1)
    if not company:
        raise HTTPException(409, "Default company is not configured")
    company.company_name = data.portal_name
    await db.commit()
    return {"portal_name": company.company_name}
