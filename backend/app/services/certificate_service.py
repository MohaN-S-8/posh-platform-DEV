import io
import uuid
from datetime import date, datetime, timezone
from typing import Optional

import qrcode
from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import generate_presigned_url, upload_file
from app.models.certificate import Certificate, CertificateTemplate
from app.models.user import UserMaster
from app.models.video import VideoMaster

CERT_BUCKET = "posh-certificates"


class CertificateService:

    async def generate_certificate(
        self,
        db,
        user_id: int,
        video_id: int,
        company_id: int,
    ) -> Certificate:
        """
        Full certificate generation workflow:
        1. Generate unique certificate number
        2. Generate QR code PNG
        3. Generate PDF certificate
        4. Upload both to MinIO
        5. Save record to DB
        """

        # 1. Fetch user and video details scoped to the same company
        user_result = await db.execute(
            select(UserMaster).where(
                UserMaster.user_id == user_id,
                UserMaster.company_id == company_id,
                UserMaster.status == "Active",
                UserMaster.is_deleted == "N",
            )
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(404, "User not found")

        video_result = await db.execute(
            select(VideoMaster).where(
                VideoMaster.video_id == video_id,
                VideoMaster.company_id == company_id,
            )
        )
        video = video_result.scalar_one_or_none()
        if not video:
            raise HTTPException(404, "Video not found")

        existing_result = await db.execute(
            select(Certificate).where(
                Certificate.user_id == user_id,
                Certificate.video_id == video_id,
                Certificate.company_id == company_id,
                Certificate.status == "Valid",
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return existing

        template_result = await db.execute(
            select(CertificateTemplate)
            .where(
                CertificateTemplate.company_id == company_id,
                CertificateTemplate.status == "Active",
            )
            .order_by(
                CertificateTemplate.updated_date.desc(), CertificateTemplate.template_id.desc()
            )
            .limit(1)
        )
        template = template_result.scalar_one_or_none()

        # 2. Generate unique certificate number
        year = datetime.now().year
        cert_number = f"POSH-{year}-{uuid.uuid4().hex[:10].upper()}"

        # 3. Generate QR code
        verify_base_url = settings.PUBLIC_APP_URL.rstrip("/")
        verify_url = f"{verify_base_url}/api/v1/certificates/verify/{cert_number}"
        qr_bytes = self._generate_qr(verify_url)
        qr_path = f"certificates/{company_id}/qr/{cert_number}.png"
        upload_file(qr_bytes, CERT_BUCKET, qr_path, "image/png")

        # 4. Generate PDF certificate
        employee_name = f"{user.first_name} {user.last_name or ''}".strip()
        pdf_bytes = self._generate_pdf(
            employee_name=employee_name,
            course_name=video.title,
            cert_number=cert_number,
            completion_date=date.today(),
            template=template,
        )
        pdf_path = f"certificates/{company_id}/pdf/{cert_number}.pdf"
        upload_file(pdf_bytes, CERT_BUCKET, pdf_path, "application/pdf")

        # 5. Save to DB
        certificate = Certificate(
            user_id=user_id,
            video_id=video_id,
            company_id=company_id,
            template_id=template.template_id if template else None,
            certificate_number=cert_number,
            course_name=video.title,
            completion_date=date.today(),
            issue_date=date.today(),
            qr_code_path=qr_path,
            pdf_path=pdf_path,
            status="Valid",
        )
        db.add(certificate)
        await db.commit()
        await db.refresh(certificate)
        from app.core.email import send_certificate_email

        try:
            await send_certificate_email(
                to=user.email,
                first_name=user.first_name,
                course_name=video.title,
                cert_number=cert_number,
                pdf_bytes=pdf_bytes,
            )
        except Exception:
            pass  # Don't fail certificate generation if email fails

        return certificate

    def _generate_qr(self, url: str) -> bytes:
        """Generate QR code as PNG bytes."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.read()

    def _generate_pdf(
        self,
        employee_name: str,
        course_name: str,
        cert_number: str,
        completion_date: date,
        template: Optional[CertificateTemplate] = None,
    ) -> bytes:
        """Generate certificate PDF using ReportLab."""
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A4),
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        getSampleStyleSheet()
        story = []

        # Title
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.styles import ParagraphStyle

        brand_color = template.color_code if template else "#1a3c5e"
        font_name = template.font_name if template else "Helvetica"
        title_font = "Helvetica-Bold" if font_name == "Helvetica" else font_name

        title_style = ParagraphStyle(
            "Title",
            fontSize=28,
            textColor=colors.HexColor(brand_color),
            alignment=TA_CENTER,
            fontName=title_font,
            spaceAfter=20,
        )
        body_style = ParagraphStyle(
            "Body",
            fontSize=14,
            alignment=TA_CENTER,
            fontName=font_name,
            spaceAfter=12,
        )
        name_style = ParagraphStyle(
            "Name",
            fontSize=22,
            textColor=colors.HexColor(brand_color),
            alignment=TA_CENTER,
            fontName=title_font,
            spaceAfter=16,
        )
        small_style = ParagraphStyle(
            "Small",
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.grey,
            fontName=font_name,
        )

        story.append(Spacer(1, 1 * cm))
        if template and template.logo_path:
            try:
                story.append(
                    Image(
                        generate_presigned_url(CERT_BUCKET, template.logo_path, 300),
                        width=3 * cm,
                        height=2 * cm,
                    )
                )
                story.append(Spacer(1, 0.3 * cm))
            except Exception:
                pass
        story.append(Paragraph("Certificate of Completion", title_style))
        story.append(Paragraph("This is to certify that", body_style))
        story.append(Paragraph(employee_name, name_style))
        story.append(Paragraph("has successfully completed the POSH Training course", body_style))
        story.append(Paragraph(f"<b>{course_name}</b>", body_style))
        story.append(Spacer(1, 0.5 * cm))
        story.append(
            Paragraph(
                f"Completion Date: {completion_date.strftime('%d %B %Y')}",
                body_style,
            )
        )
        story.append(Spacer(1, 1 * cm))
        if template and template.signature_path:
            try:
                story.append(
                    Image(
                        generate_presigned_url(CERT_BUCKET, template.signature_path, 300),
                        width=4 * cm,
                        height=1.5 * cm,
                    )
                )
                story.append(Spacer(1, 0.2 * cm))
            except Exception:
                pass
        story.append(Paragraph(f"Certificate Number: {cert_number}", small_style))
        story.append(
            Paragraph(
                f"Verify at: {settings.PUBLIC_APP_URL.rstrip('/')}/api/v1/certificates/verify/{cert_number}",
                small_style,
            )
        )

        doc.build(story)
        buf.seek(0)
        return buf.read()

    async def get_download_url(self, db, certificate_id: int, user_id: int) -> dict:
        """Get a short-lived signed URL to download the certificate PDF."""
        result = await db.execute(
            select(Certificate).where(
                Certificate.certificate_id == certificate_id,
                Certificate.user_id == user_id,
                Certificate.status == "Valid",
            )
        )
        cert = result.scalar_one_or_none()
        if not cert:
            raise HTTPException(404, "Certificate not found.")

        url = generate_presigned_url(CERT_BUCKET, cert.pdf_path, 300)
        return {"download_url": url, "certificate_number": cert.certificate_number}

    async def verify_certificate(self, db, certificate_number: str) -> dict:
        """
        Public endpoint — verifies a certificate by its number.
        Called when someone scans a QR code.
        Returns minimal info (no sensitive PII).
        """
        result = await db.execute(
            select(Certificate, UserMaster)
            .join(UserMaster, Certificate.user_id == UserMaster.user_id)
            .where(Certificate.certificate_number == certificate_number)
        )
        row = result.first()

        if not row:
            return {
                "valid": False,
                "message": "Certificate not found.",
                "certificate_number": certificate_number,
            }

        cert, user = row

        # Mask last name: "Ravi Kumar" → "Ravi K."
        last_initial = f"{user.last_name[0]}." if user.last_name else ""
        masked_name = f"{user.first_name} {last_initial}".strip()

        return {
            "valid": cert.status == "Valid",
            "certificate_number": cert.certificate_number,
            "employee_name": masked_name,
            "course_name": cert.course_name,
            "completion_date": str(cert.completion_date),
            "issue_date": str(cert.issue_date),
            "status": cert.status,
        }

    async def revoke_certificate(self, db, certificate_id: int) -> dict:
        """Revoke a certificate (Super Admin only)."""
        result = await db.execute(
            select(Certificate).where(Certificate.certificate_id == certificate_id)
        )
        cert = result.scalar_one_or_none()
        if not cert:
            raise HTTPException(404, "Certificate not found.")
        cert.status = "Revoked"
        await db.commit()
        return {"message": f"Certificate {cert.certificate_number} revoked."}

    async def list_user_certificates(self, db, user_id: int) -> list:
        """List all certificates for a user."""
        result = await db.execute(
            select(Certificate).where(
                Certificate.user_id == user_id,
                Certificate.status == "Valid",
            )
        )
        return result.scalars().all()

    async def list_templates(self, db, company_id: int) -> list:
        result = await db.execute(
            select(CertificateTemplate)
            .where(CertificateTemplate.company_id == company_id)
            .order_by(CertificateTemplate.created_date.desc())
        )
        return result.scalars().all()

    async def create_template(self, db, data, company_id: int) -> CertificateTemplate:
        template = CertificateTemplate(
            template_name=data.template_name.strip(),
            font_name=data.font_name or "Helvetica",
            color_code=data.color_code or "#1a3c5e",
            company_id=company_id,
            status="Active",
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        return template

    async def update_template(self, db, template_id: int, data, company_id: int):
        result = await db.execute(
            select(CertificateTemplate).where(
                CertificateTemplate.template_id == template_id,
                CertificateTemplate.company_id == company_id,
            )
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(404, "Certificate template not found.")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)
        await db.commit()
        await db.refresh(template)
        return template

    async def set_template_status(
        self, db, template_id: int, new_status: str, company_id: int
    ) -> dict:
        result = await db.execute(
            select(CertificateTemplate).where(
                CertificateTemplate.template_id == template_id,
                CertificateTemplate.company_id == company_id,
            )
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(404, "Certificate template not found.")
        template.status = new_status
        await db.commit()
        return {"message": f"Template {new_status.lower()} successfully."}

    async def upload_template_asset(
        self, db, template_id: int, company_id: int, file, asset_type: str
    ) -> CertificateTemplate:
        if asset_type not in ["logo", "signature"]:
            raise HTTPException(400, "asset_type must be logo or signature.")
        result = await db.execute(
            select(CertificateTemplate).where(
                CertificateTemplate.template_id == template_id,
                CertificateTemplate.company_id == company_id,
            )
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(404, "Certificate template not found.")

        file_bytes = await file.read()
        extension = (file.filename or f"{asset_type}.png").split(".")[-1].lower()
        object_key = f"certificate-templates/{company_id}/{template_id}/{asset_type}.{extension}"
        upload_file(
            file_bytes, CERT_BUCKET, object_key, file.content_type or "application/octet-stream"
        )

        if asset_type == "logo":
            template.logo_path = object_key
        else:
            template.signature_path = object_key
        await db.commit()
        await db.refresh(template)
        return template
