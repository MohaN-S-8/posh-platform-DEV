import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles, require_roles_with_matrix
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

# Role IDs: 1=Super Admin, 2=Admin, 5=Client / Management, 3=IC, 4=Employee
ADMIN_ROLES = [1, 2]
WORK_ORDER_ACCESS = ["Company Setup", "Create Company & Work Order"]
REGISTRATION_ACCESS = [
    "Company Setup",
    "Company Registration",
    "Company Registration - PoSH",
]
EMPLOYEE_MASTER_ACCESS = ["User Master", "Employee Master", "Employee Master - PoSH"]

EMPLOYEE_MASTER_BULK_TEMPLATE_COLUMNS = [
    "company_id",
    "employee_id",
    "first_name",
    "last_name",
    "email",
    "mobile",
    "date_of_birth",
    "father_name",
    "emergency_contact",
    "gender",
    "blood_group",
    "physically_challenged",
    "marital_status",
    "pan_number",
    "foreign_national",
    "joining_date",
    "designation",
    "department",
    "location_city",
    "employment_status",
    "employee_status",
    "resignation_date",
    "resignation_reason",
    "reporting_to",
    "branch_name",
    "branch_id",
    "transfer_date",
    "transfer_location",
    "transfer_branch_name",
    "transfer_branch_id",
    "ic_role",
]


@router.get("/", response_model=list[CompanyResponse])
async def list_companies(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix(ADMIN_ROLES, WORK_ORDER_ACCESS)),
):
    """List work-order companies visible to the current admin."""
    return await company_service.get_visible_for_user(db, current_user)


@router.post("/", response_model=CompanyResponse, status_code=201)
async def create_company(
    data: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix(ADMIN_ROLES, WORK_ORDER_ACCESS)),
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
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], EMPLOYEE_MASTER_ACCESS)),
):
    """List POSH employee-master records for registration workflows."""
    return await company_service.get_employee_master_records(db, current_user, company_id)


@router.post("/employee-master/", response_model=EmployeeMasterResponse, status_code=201)
async def create_employee_master(
    data: EmployeeMasterCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], EMPLOYEE_MASTER_ACCESS)),
):
    """Create employee-master records used by POSH registration."""
    return await company_service.create_employee_master_record(db, data, current_user)


@router.get("/employee-master/template")
async def download_user_master_template(
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], EMPLOYEE_MASTER_ACCESS)),
):
    """Download the CSV template for User Master bulk upload."""
    default_company_id = "" if current_user.role_id in ADMIN_ROLES else current_user.company_id
    rows = [
        EMPLOYEE_MASTER_BULK_TEMPLATE_COLUMNS,
        [
            default_company_id,
            "EMP001",
            "Employee",
            "User",
            "employee@example.com",
            "9876543210",
            "1990-01-01",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "2026-01-01",
            "Executive",
            "Operations",
            "Chennai",
            "Active",
            "Active",
            "",
            "",
            "",
            "Main Branch",
            "BR001",
            "",
            "",
            "",
            "",
            "",
        ],
    ]
    output = io.StringIO()
    csv.writer(output).writerows(rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="user_master_template.csv"'},
    )


@router.post("/employee-master/bulk-upload")
async def bulk_upload_employee_master(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], EMPLOYEE_MASTER_ACCESS)),
):
    """Bulk-create User Master records from the CSV template."""
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(400, "Upload a CSV file with a header row.")

    created = []
    errors = []
    for row_number, row in enumerate(reader, start=2):
        if not any(str(value or "").strip() for value in row.values()):
            continue
        try:
            payload = {
                key: (str(row.get(key) or "").strip() or None)
                for key in EMPLOYEE_MASTER_BULK_TEMPLATE_COLUMNS
            }
            payload["company_id"] = int(payload["company_id"] or current_user.company_id or 0)
            data = EmployeeMasterCreate(**payload)
            employee = await company_service.create_employee_master_record(
                db,
                data,
                current_user,
            )
            created.append(
                {
                    "row": row_number,
                    "id": employee["id"],
                    "employee_id": employee["employee_id"],
                    "email": employee["email"],
                }
            )
        except (HTTPException, ValidationError, ValueError) as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(exc, ValidationError):
                detail = "; ".join(
                    f"{'.'.join(str(loc) for loc in error['loc'])}: {error['msg']}"
                    for error in exc.errors()
                )
            errors.append({"row": row_number, "error": str(detail or exc)})

    return {
        "created_count": len(created),
        "error_count": len(errors),
        "created": created,
        "errors": errors,
    }


@router.put("/employee-master/{employee_master_id}", response_model=EmployeeMasterResponse)
async def update_employee_master(
    employee_master_id: int,
    data: EmployeeMasterCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], EMPLOYEE_MASTER_ACCESS)),
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
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], EMPLOYEE_MASTER_ACCESS)),
):
    """Delete a POSH employee-master record."""
    return await company_service.delete_employee_master_record(db, employee_master_id, current_user)


@router.patch("/employee-master/{employee_master_id}/status")
async def update_employee_master_status(
    employee_master_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([1, 2, 5, 3], EMPLOYEE_MASTER_ACCESS)),
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
    current_user=Depends(
        require_roles_with_matrix(ADMIN_ROLES, WORK_ORDER_ACCESS + REGISTRATION_ACCESS)
    ),
):
    """Read state, city, and scope codes used by the company form."""
    return await company_service.get_company_master_codes(db)


@router.get("/assigned-work-orders/")
async def list_assigned_work_orders(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2, 3])),
):
    """List approved/pending work-order services assigned to the current admin/IC user."""
    return await company_service.get_assigned_work_orders(db, current_user.user_id)


@router.get("/registration-candidates/", response_model=list[CompanyResponse])
async def list_registration_candidates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix(ADMIN_ROLES, REGISTRATION_ACCESS)),
):
    """List approved companies available for POSH company registration."""
    return await company_service.get_registration_candidates(db, current_user)


@router.put("/{company_id}/registration", response_model=CompanyResponse)
async def update_company_registration(
    company_id: int,
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix(ADMIN_ROLES, REGISTRATION_ACCESS)),
):
    """Save POSH company registration details for an approved work-order company."""
    return await company_service.update_registration(db, company_id, data, current_user)


@router.post("/{company_id}/policy-document", response_model=CompanyResponse)
async def upload_company_policy_document(
    company_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2, 5])),
):
    """Upload the company-specific PoSH policy PDF used by employee and IC portals."""
    filename = file.filename or "posh-policy.pdf"
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension != "pdf" or file.content_type not in {
        "application/pdf",
        "application/octet-stream",
    }:
        raise HTTPException(400, "Please upload a PDF policy document.")
    return await company_service.upload_policy_document(
        db,
        company_id,
        await file.read(),
        filename,
        current_user,
    )


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
    current_user=Depends(
        require_roles_with_matrix(ADMIN_ROLES, WORK_ORDER_ACCESS + REGISTRATION_ACCESS)
    ),
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
    current_user=Depends(
        require_roles_with_matrix(ADMIN_ROLES, WORK_ORDER_ACCESS + REGISTRATION_ACCESS)
    ),
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
    current_user=Depends(require_roles_with_matrix(ADMIN_ROLES, REGISTRATION_ACCESS)),
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
    current_user=Depends(require_roles_with_matrix(ADMIN_ROLES, WORK_ORDER_ACCESS)),
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
