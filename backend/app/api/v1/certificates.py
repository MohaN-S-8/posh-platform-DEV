from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, require_role
from app.db.session import get_db
from app.schemas.certificate import (
    CertificateTemplateCreate,
    CertificateTemplateResponse,
    CertificateTemplateUpdate,
)
from app.services.audit_service import write_audit_log
from app.services.certificate_service import CertificateService

router = APIRouter(prefix="/certificates", tags=["Certificates"])
cert_service = CertificateService()


@router.get("/templates", response_model=list[CertificateTemplateResponse])
async def list_certificate_templates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Admin: list certificate templates for the current company."""
    return await cert_service.list_templates(db, current_user.company_id)


@router.post("/templates", response_model=CertificateTemplateResponse, status_code=201)
async def create_certificate_template(
    data: CertificateTemplateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("certificates.manage")),
):
    """Admin: create a certificate template for the current company."""
    template = await cert_service.create_template(db, data, current_user.company_id)
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
    template = await cert_service.update_template(db, template_id, data, current_user.company_id)
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
    """Admin: activate or deactivate a certificate template."""
    if status not in ["Active", "Inactive"]:
        from fastapi import HTTPException

        raise HTTPException(400, "Status must be 'Active' or 'Inactive'")
    result = await cert_service.set_template_status(
        db, template_id, status, current_user.company_id
    )
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
    """Admin: upload template logo or signature image."""
    template = await cert_service.upload_template_asset(
        db, template_id, current_user.company_id, file, asset_type
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


@router.get("/my")
async def my_certificates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(4)),
):
    """Employee: list all my certificates."""
    return await cert_service.list_user_certificates(db, current_user.user_id)


@router.get("/{certificate_id}/download")
async def download_certificate(
    certificate_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(4)),
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
    cert = await cert_service.generate_certificate(db, user_id, video_id, current_user.company_id)
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=current_user.company_id,
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
