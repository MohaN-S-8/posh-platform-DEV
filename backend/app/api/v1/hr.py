from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.schemas.hr import TrainingAssignRequest
from app.services.audit_service import write_audit_log
from app.services.hr_service import HRService

router = APIRouter(prefix="/hr", tags=["HR Portal"])
hr_service = HRService()


@router.get("/employees")
async def list_assignable_employees(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("training.assign")),
):
    """List active employees and departments available for training assignment."""
    return await hr_service.list_assignable_employees(db, current_user.company_id)


@router.post("/employees/bulk-upload")
async def bulk_upload_employees(
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("training.assign")),
):
    """
    Upload Excel or CSV file to create employees in bulk.
    Returns success count and per-row error details.
    Supported formats: .xlsx, .xls, .csv
    Required columns: employee_id, first_name, email, mobile
    """
    result = await hr_service.bulk_upload_employees(
        db, file, current_user.company_id, current_user.user_id
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="EMPLOYEE_BULK_UPLOAD",
        table_name="employee_upload_batch",
        record_id=result.get("batch_id"),
        ip_address=request.client.host if request and request.client else None,
    )
    await db.commit()
    return result


@router.post("/training/assign")
async def assign_training(
    data: TrainingAssignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("training.assign")),
):
    """
    Assign a training video to:
    - Individual employee (assign_type: Individual, assigned_to_user_id required)
    - Department (assign_type: Department, assigned_to_department required)
    - Entire company (assign_type: Company-Wide)
    """
    result = await hr_service.assign_training(
        db, data, current_user.company_id, current_user.user_id
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="TRAINING_ASSIGNED",
        table_name="course_assignment",
        record_id=data.video_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.get("/compliance/dashboard")
async def compliance_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """
    Compliance overview for the company:
    total employees, completed, in-progress, not-started, compliance rate,
    department breakdown, and overdue employees list.
    """
    return await hr_service.get_compliance_dashboard(db, current_user.company_id)


@router.get("/reports/employees")
async def download_employee_report(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """
    Download employee training report as Excel file.
    Contains all employees with their training status and completion %.
    """
    excel_bytes = await hr_service.generate_employee_report(db, current_user.company_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=employee_training_report.xlsx"},
    )


@router.get("/reports/departments")
async def download_department_report(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Download department compliance report as Excel file."""
    excel_bytes = await hr_service.generate_department_report(db, current_user.company_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=department_compliance_report.xlsx"},
    )


@router.get("/reports/certificates")
async def download_certificate_report(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """Download issued certificate report as Excel file."""
    excel_bytes = await hr_service.generate_certificate_report(db, current_user.company_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=certificate_report.xlsx"},
    )


@router.get("/reports/employees.csv")
async def download_employee_report_csv(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    csv_bytes = await hr_service.generate_employee_report_csv(db, current_user.company_id)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=employee_training_report.csv"},
    )


@router.get("/reports/departments.csv")
async def download_department_report_csv(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    csv_bytes = await hr_service.generate_department_report_csv(db, current_user.company_id)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=department_compliance_report.csv"},
    )


@router.get("/reports/certificates.csv")
async def download_certificate_report_csv(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    csv_bytes = await hr_service.generate_certificate_report_csv(db, current_user.company_id)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=certificate_report.csv"},
    )


@router.get("/reports/employees.pdf")
async def download_employee_report_pdf(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    pdf_bytes = await hr_service.generate_employee_report_pdf(db, current_user.company_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=employee_training_report.pdf"},
    )


@router.get("/reports/departments.pdf")
async def download_department_report_pdf(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    pdf_bytes = await hr_service.generate_department_report_pdf(db, current_user.company_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=department_compliance_report.pdf"},
    )


@router.get("/reports/certificates.pdf")
async def download_certificate_report_pdf(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    pdf_bytes = await hr_service.generate_certificate_report_pdf(db, current_user.company_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=certificate_report.pdf"},
    )


@router.post("/notifications/send-reminders")
async def send_training_reminders(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("training.assign")),
):
    result = await hr_service.create_training_reminders(
        db, current_user.company_id, current_user.user_id
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="TRAINING_REMINDERS_CREATED",
        table_name="notification",
        record_id=None,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result
