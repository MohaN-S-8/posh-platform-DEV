from typing import Optional

from pydantic import BaseModel, field_validator


class MasterCodeBase(BaseModel):
    category: str
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True

    @field_validator("category", "name", "code")
    @classmethod
    def required_text(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value


class MasterCodeCreate(MasterCodeBase):
    pass


class MasterCodeUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class MasterCodeResponse(MasterCodeBase):
    id: int


class PoshOfficeBase(BaseModel):
    office_name: str
    office_address: str
    is_active: bool = True

    @field_validator("office_name", "office_address")
    @classmethod
    def required_text(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value


class PoshOfficeCreate(PoshOfficeBase):
    pass


class PoshOfficeUpdate(BaseModel):
    office_name: Optional[str] = None
    office_address: Optional[str] = None
    is_active: Optional[bool] = None


class PoshOfficeResponse(PoshOfficeBase):
    id: int


class RoleAccessBase(BaseModel):
    role_label: str
    access_item: str
    access_status: str = "Access enabled"
    is_allowed: bool = True
    display_order: int = 1

    @field_validator("role_label", "access_item")
    @classmethod
    def required_text(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value


class RoleAccessCreate(RoleAccessBase):
    pass


class RoleAccessUpdate(BaseModel):
    role_label: Optional[str] = None
    access_item: Optional[str] = None
    access_status: Optional[str] = None
    is_allowed: Optional[bool] = None
    display_order: Optional[int] = None


class RoleAccessResponse(RoleAccessBase):
    id: int


class AdminConfigResponse(BaseModel):
    master_codes: list[MasterCodeResponse]
    offices: list[PoshOfficeResponse]
    role_access: list[RoleAccessResponse]
