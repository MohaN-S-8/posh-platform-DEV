from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, require_roles_with_matrix
from app.db.session import get_db
from app.models.certificate import Certificate
from app.models.company import CompanyMaster
from app.models.training import AssessmentResult
from app.models.user import UserMaster
from app.models.video import VideoMaster
from app.schemas.certificate import (
    CertificateTemplateCreate,
    CertificateTemplateResponse,
    CertificateTemplateUpdate,
)
from app.services.audit_service import write_audit_log
from app.services.certificate_service import CertificateService
from app.services.company_service import CompanyService

router = APIRouter(prefix="/certificates", tags=["Certificates"])
cert_service = CertificateService()


async def _certificate_company_scope(db: AsyncSession, current_user) -> list[CompanyMaster]:
    if current_user.role_id == 1:
        result = await db.execute(
            select(CompanyMaster)
            .where(
                CompanyMaster.is_deleted == "N",
                CompanyMaster.company_id != 1,
            )
            .order_by(CompanyMaster.company_name.asc())
        )
        return result.scalars().all()
    if current_user.role_id == 5:
        result = await db.execute(
            select(CompanyMaster).where(
                CompanyMaster.company_id == current_user.company_id,
                CompanyMaster.is_deleted == "N",
            )
        )
        company = result.scalar_one_or_none()
        return [company] if company else []

    companies = await CompanyService().get_visible_for_user(db, current_user)
    return sorted(companies, key=lambda company: company.company_name or "")


@router.get("/manual-candidates")
async def list_manual_certificate_candidates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """List passed assessments that do not yet have a valid certificate."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can issue certificates.",
        )

    filters = [
        AssessmentResult.result == "Pass",
        UserMaster.status == "Active",
        UserMaster.is_deleted == "N",
        Certificate.certificate_id.is_(None),
        CompanyMaster.certificate_issue_mode == "Manual",
    ]
    if current_user.role_id not in [1, 2]:
        filters.append(UserMaster.company_id == current_user.company_id)

    result = await db.execute(
        select(
            AssessmentResult.user_id,
            AssessmentResult.video_id,
            UserMaster.first_name,
            UserMaster.last_name,
            UserMaster.email,
            UserMaster.company_id,
            CompanyMaster.company_name,
            VideoMaster.title,
            AssessmentResult.score,
            AssessmentResult.attempted_at,
        )
        .join(UserMaster, UserMaster.user_id == AssessmentResult.user_id)
        .join(
            VideoMaster,
            (VideoMaster.video_id == AssessmentResult.video_id)
            & (VideoMaster.company_id == UserMaster.company_id),
        )
        .join(CompanyMaster, CompanyMaster.company_id == UserMaster.company_id)
        .outerjoin(
            Certificate,
            (Certificate.user_id == AssessmentResult.user_id)
            & (Certificate.video_id == AssessmentResult.video_id)
            & (Certificate.company_id == UserMaster.company_id)
            & (Certificate.status == "Valid"),
        )
        .where(*filters)
        .order_by(
            CompanyMaster.company_name.asc(),
            UserMaster.first_name.asc(),
            VideoMaster.title.asc(),
            AssessmentResult.attempted_at.desc(),
        )
    )
    candidates = []
    seen = set()
    for row in result.mappings().all():
        key = (row["user_id"], row["video_id"], row["company_id"])
        if key in seen:
            continue
        seen.add(key)
        candidates.append(
            {
                "user_id": row["user_id"],
                "video_id": row["video_id"],
                "company_id": row["company_id"],
                "company_name": row["company_name"],
                "employee_name": f"{row['first_name']} {row['last_name'] or ''}".strip(),
                "email": row["email"],
                "course_name": row["title"],
                "score": float(row["score"] or 0),
                "attempted_at": row["attempted_at"],
            }
        )
    return candidates


@router.get("/issue-modes")
async def list_certificate_issue_modes(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """List certificate issue mode per visible company."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can manage certificate issue mode.",
        )
    companies = await _certificate_company_scope(db, current_user)
    return [
        {
            "company_id": company.company_id,
            "company_name": company.company_name,
            "company_code": company.company_code,
            "certificate_issue_mode": company.certificate_issue_mode or "Automatic",
        }
        for company in companies
    ]


@router.patch("/issue-modes/{company_id}")
async def update_certificate_issue_mode(
    company_id: int,
    mode: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Switch a company's certificate issue flow between Automatic and Manual."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can manage certificate issue mode.",
        )
    if mode not in {"Automatic", "Manual"}:
        raise HTTPException(400, "Mode must be Automatic or Manual.")

    visible_companies = await _certificate_company_scope(db, current_user)
    company = next(
        (item for item in visible_companies if item.company_id == company_id),
        None,
    )
    if not company:
        raise HTTPException(403, "You do not have permission to update this company.")

    company.certificate_issue_mode = mode
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=company.company_id,
        action=f"CERTIFICATE_ISSUE_MODE_{mode.upper()}",
        table_name="company_master",
        record_id=company.company_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return {
        "company_id": company.company_id,
        "company_name": company.company_name,
        "certificate_issue_mode": company.certificate_issue_mode,
    }


@router.get("/templates", response_model=list[CertificateTemplateResponse])
async def list_certificate_templates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """List certificate templates. Super Admin sees all companies; others see their company."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can manage certificate templates.",
        )
    company_id = None if current_user.role_id == 1 else current_user.company_id
    return await cert_service.list_templates(db, company_id)


@router.post("/templates", response_model=CertificateTemplateResponse, status_code=201)
async def create_certificate_template(
    data: CertificateTemplateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Create a certificate template. Client/company uploads wait for Super Admin approval."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can manage certificate templates.",
        )
    initial_status = "Active" if current_user.role_id == 1 else "Pending"
    template = await cert_service.create_template(db, data, current_user.company_id, initial_status)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="CERTIFICATE_TEMPLATE_CREATED",
        table_name="certificate_template",
        record_id=template.template_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return template


@router.put("/templates/{template_id}", response_model=CertificateTemplateResponse)
async def update_certificate_template(
    template_id: int,
    data: CertificateTemplateUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Admin: update a certificate template."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can manage certificate templates.",
        )
    company_id = None if current_user.role_id == 1 else current_user.company_id
    template = await cert_service.update_template(
        db,
        template_id,
        data,
        company_id,
        require_reapproval=current_user.role_id != 1,
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="CERTIFICATE_TEMPLATE_UPDATED",
        table_name="certificate_template",
        record_id=template_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return template


@router.patch("/templates/{template_id}/status")
async def update_certificate_template_status(
    template_id: int,
    status: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Super Admin: approve, reject, activate, or deactivate a certificate template."""
    if current_user.role_id != 1:
        raise HTTPException(403, "Only Super Admin can approve certificate templates.")
    if status not in ["Active", "Inactive", "Rejected", "Pending"]:
        raise HTTPException(400, "Status must be Pending, Active, Inactive, or Rejected.")
    result = await cert_service.set_template_status(db, template_id, status, None)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action=f"CERTIFICATE_TEMPLATE_{status.upper()}",
        table_name="certificate_template",
        record_id=template_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/templates/{template_id}/asset", response_model=CertificateTemplateResponse)
async def upload_certificate_template_asset(
    template_id: int,
    asset_type: str = Form(...),
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Upload template logo, signature, or ready-made file."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can manage certificate templates.",
        )
    company_id = None if current_user.role_id == 1 else current_user.company_id
    template = await cert_service.upload_template_asset(
        db,
        template_id,
        company_id,
        file,
        asset_type,
        require_reapproval=current_user.role_id != 1,
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action=f"CERTIFICATE_TEMPLATE_{asset_type.upper()}_UPLOADED",
        table_name="certificate_template",
        record_id=template_id,
        ip_address=request.client.host if request and request.client else None,
    )
    await db.commit()
    return template


@router.delete("/templates/{template_id}")
async def delete_certificate_template(
    template_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Admin: delete a template and detach issued certificates from it."""
    if current_user.role_id not in [1, 2, 5]:
        raise HTTPException(
            403,
            "Only Super Admin, Admin, and Client / Management can manage certificate templates.",
        )
    company_id = None if current_user.role_id == 1 else current_user.company_id
    result = await cert_service.delete_template(
        db,
        template_id,
        company_id,
        allow_active_delete=current_user.role_id == 1,
    )
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="CERTIFICATE_TEMPLATE_DELETED",
        table_name="certificate_template",
        record_id=template_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.get("/my")
async def my_certificates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([3, 4], ["Assessment & Certificate"])),
):
    """Employee: list all my certificates."""
    return await cert_service.list_user_certificates(db, current_user.user_id)


@router.get("/{certificate_id}/download")
async def download_certificate(
    certificate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles_with_matrix([3, 4], ["Assessment & Certificate"])),
):
    """Employee: get a signed URL to download a certificate PDF."""
    return await cert_service.get_download_url(db, certificate_id, current_user.user_id)


@router.get("/verify/{certificate_number}")
async def verify_certificate(
    certificate_number: str,
    db: AsyncSession = Depends(get_db),
):
    """
    PUBLIC endpoint — no authentication required.
    Called when someone scans a QR code.
    Rate-limited at Nginx level.
    """
    return await cert_service.verify_certificate(db, certificate_number)


@router.post("/{certificate_id}/revoke")
async def revoke_certificate(
    certificate_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Super Admin: revoke a certificate."""
    if current_user.role_id != 1:
        raise HTTPException(403, "Only Super Admin can revoke certificates.")
    result = await cert_service.revoke_certificate(db, certificate_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
        action="CERTIFICATE_REVOKED",
        table_name="certificate",
        record_id=certificate_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


@router.post("/generate")
async def generate_certificate_manual(
    user_id: int,
    video_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """
    Manually trigger certificate generation.
    In production this is called automatically after assessment pass.
    """
    user_result = await db.execute(
        select(UserMaster.company_id).where(
            UserMaster.user_id == user_id,
            UserMaster.status == "Active",
            UserMaster.is_deleted == "N",
        )
    )
    target_company_id = user_result.scalar_one_or_none()
    if not target_company_id:
        raise HTTPException(404, "User not found.")
    if current_user.role_id not in [1, 2] and target_company_id != current_user.company_id:
        raise HTTPException(403, "You can only issue certificates for your company.")

    cert = await cert_service.generate_certificate(db, user_id, video_id, target_company_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=target_company_id,
        action="CERTIFICATE_GENERATED_MANUALLY",
        table_name="certificate",
        record_id=cert.certificate_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return {
        "message": "Certificate generated successfully.",
        "certificate_number": cert.certificate_number,
        "certificate_id": cert.certificate_id,
    }
