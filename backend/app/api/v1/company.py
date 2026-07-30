from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.db.session import get_db
from app.schemas.company import (
    CompanyCreate,
    CompanyLanguagePreference,
    CompanyLanguageUpdate,
    CompanyResponse,
    CompanyUpdate,
    EmployeeMasterCreate,
    EmployeeMasterResponse,
)
from app.schemas.user import UserCreate, UserResponse
from app.services.company_service import CompanyService
from app.services.user_service import UserService

router = APIRouter(prefix="/companies", tags=["Company Management"])
company_service = CompanyService()
user_service = UserService()

# Role IDs: 1=Super Admin, 2=Admin, 5=Client / Management, 3=HR / IC, 4=Employee
ADMIN_ROLES = [1, 2]


@router.get("/", response_model=list[CompanyResponse])
async def list_companies(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """List work-order companies visible to the current admin."""
    return await company_service.get_visible_for_user(db, current_user)


@router.post("/", response_model=CompanyResponse, status_code=201)
async def create_company(
    data: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Create a new company."""
    return await company_service.create(db, data, current_user)


@router.get("/assignable-users/")
async def list_assignable_users(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2, 5, 3])),
):
    """List users assignable by the current role hierarchy."""
    return await company_service.get_assignable_users(db, current_user)


@router.get("/employee-master/", response_model=list[EmployeeMasterResponse])
async def list_employee_master(
    company_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """List POSH employee-master records for registration workflows."""
    return await company_service.get_employee_master_records(db, current_user, company_id)


@router.post("/employee-master/", response_model=EmployeeMasterResponse, status_code=201)
async def create_employee_master(
    data: EmployeeMasterCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Create employee-master records used by POSH registration."""
    return await company_service.create_employee_master_record(db, data, current_user)


@router.put("/employee-master/{employee_master_id}", response_model=EmployeeMasterResponse)
async def update_employee_master(
    employee_master_id: int,
    data: EmployeeMasterCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Update a POSH employee-master record."""
    return await company_service.update_employee_master_record(
        db,
        employee_master_id,
        data,
        current_user,
    )


@router.delete("/employee-master/{employee_master_id}")
async def delete_employee_master(
    employee_master_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Delete a POSH employee-master record."""
    return await company_service.delete_employee_master_record(db, employee_master_id, current_user)


@router.patch("/employee-master/{employee_master_id}/status")
async def update_employee_master_status(
    employee_master_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Activate or deactivate a POSH employee-master record."""
    return await company_service.set_employee_master_status(
        db,
        employee_master_id,
        status,
        current_user,
    )


@router.get("/master-codes/")
async def list_company_master_codes(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Read state, city, and scope codes used by the company form."""
    return await company_service.get_company_master_codes(db)


@router.get("/assigned-work-orders/")
async def list_assigned_work_orders(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2, 3])),
):
    """List approved/pending work-order services assigned to the current admin/HR user."""
    return await company_service.get_assigned_work_orders(db, current_user.user_id)


@router.get("/registration-candidates/", response_model=list[CompanyResponse])
async def list_registration_candidates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """List approved companies available for POSH company registration."""
    return await company_service.get_registration_candidates(db, current_user)


@router.put("/{company_id}/registration", response_model=CompanyResponse)
async def update_company_registration(
    company_id: int,
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Save POSH company registration details for an approved work-order company."""
    return await company_service.update_registration(db, company_id, data, current_user)


@router.post("/{company_id}/client-admin", response_model=UserResponse, status_code=201)
async def create_company_client_admin(
    company_id: int,
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([2])),
):
    """Create the Client / Management login for a registered client company."""
    await company_service.ensure_registration_access(db, company_id, current_user)
    data.company_id = company_id
    data.role_id = 5
    return await user_service.create(db, data)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Get a company by ID."""
    if current_user.role_id == 2 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to access this company.")
    return await company_service.get_by_id(db, company_id)


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int,
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Update company details."""
    if current_user.role_id == 2 and not await company_service.can_access_work_order(
        db, company_id, current_user
    ):
        raise HTTPException(403, "You do not have permission to update this company.")
    return await company_service.update(db, company_id, data, current_user)


@router.get("/{company_id}/languages", response_model=list[CompanyLanguagePreference])
async def get_company_languages(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Get enabled language preferences for a company."""
    if current_user.role_id == 2 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to access this company.")
    return await company_service.get_language_preferences(db, company_id)


@router.put("/{company_id}/languages", response_model=list[CompanyLanguagePreference])
async def update_company_languages(
    company_id: int,
    data: CompanyLanguageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Configure a company's training languages and default language."""
    if current_user.role_id == 2 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to update this company.")
    return await company_service.update_language_preferences(
        db,
        company_id,
        data.language_ids,
        data.default_language_id,
    )


@router.patch("/{company_id}/status")
async def update_company_status(
    company_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES)),
):
    """Activate or deactivate a company."""
    if status not in ["Active", "Inactive"]:
        from fastapi import HTTPException

        raise HTTPException(400, "Status must be 'Active' or 'Inactive'")
    if current_user.role_id == 2 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to update this company.")
    return await company_service.set_status(db, company_id, status)


@router.patch("/{company_id}/approve")
async def approve_company_work_order(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),
):
    """Approve company work order. Super Admin/Main Admin only."""
    return await company_service.approve(db, company_id)


@router.delete("/{company_id}")
async def delete_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),
):
    """Permanently delete a company and all company-owned records."""
    return await company_service.delete(db, company_id)
