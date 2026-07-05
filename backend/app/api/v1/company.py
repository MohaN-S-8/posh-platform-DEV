from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.db.session import get_db
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.services.company_service import CompanyService

router = APIRouter(prefix="/companies", tags=["Company Management"])
company_service = CompanyService()

# Role IDs: 1=Super Admin, 2=Company Admin, 3=HR, 4=Employee
ADMIN_ROLES = [1, 2]


@router.get("/", response_model=list[CompanyResponse])
async def list_companies(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),  # Super Admin only
):
    """List all companies. Super Admin only."""
    return await company_service.get_all(db)


@router.post("/", response_model=CompanyResponse, status_code=201)
async def create_company(
    data: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),  # Super Admin only
):
    """Create a new company."""
    return await company_service.create(db, data)


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
    if current_user.role_id == 2 and current_user.company_id != company_id:
        raise HTTPException(403, "You do not have permission to update this company.")
    return await company_service.update(db, company_id, data)


@router.patch("/{company_id}/status")
async def update_company_status(
    company_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),
):
    """Activate or deactivate a company."""
    if status not in ["Active", "Inactive"]:
        from fastapi import HTTPException

        raise HTTPException(400, "Status must be 'Active' or 'Inactive'")
    return await company_service.set_status(db, company_id, status)


@router.delete("/{company_id}")
async def delete_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1])),
):
    """Soft-delete a company."""
    return await company_service.delete(db, company_id)
