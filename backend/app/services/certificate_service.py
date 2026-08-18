import io
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

import qrcode
from fastapi import HTTPException, status
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import case, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import delete_file, generate_presigned_url, read_file, upload_file
from app.models.certificate import Certificate, CertificateTemplate
from app.models.user import UserMaster
from app.models.video import VideoMaster

CERT_BUCKET = "posh-certificates"
logger = logging.getLogger(__name__)


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

        template_result = await db.execute(
            select(CertificateTemplate)
            .where(
                CertificateTemplate.company_id == company_id,
                CertificateTemplate.status == "Active",
            )
            .order_by(
                case((CertificateTemplate.template_file_path.is_not(None), 0), else_=1),
                CertificateTemplate.updated_date.desc(),
                CertificateTemplate.template_id.desc(),
            )
            .limit(1)
        )
        template = template_result.scalar_one_or_none()

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
            active_template_id = template.template_id if template else None
            if existing.template_id == active_template_id and not (
                template and template.template_file_path
            ):
                return existing

            employee_name = f"{user.first_name} {user.last_name or ''}".strip()
            pdf_bytes = self._generate_pdf(
                employee_name=employee_name,
                course_name=video.title,
                cert_number=existing.certificate_number,
                completion_date=existing.completion_date or date.today(),
                template=template,
            )
            pdf_path = (
                existing.pdf_path
                or f"certificates/{company_id}/pdf/{existing.certificate_number}.pdf"
            )
            upload_file(pdf_bytes, CERT_BUCKET, pdf_path, "application/pdf")
            existing.pdf_path = pdf_path
            existing.template_id = active_template_id
            await db.commit()
            await db.refresh(existing)
            return existing

        # 2. Generate unique certificate number
        year = datetime.now().year
        cert_number = f"POSH-{year}-{uuid.uuid4().hex[:10].upper()}"

        # 3. Generate QR code
        verify_url = self._verification_url(cert_number)
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
        if template and template.template_file_path:
            try:
                return self._generate_pdf_from_ready_template(
                    employee_name=employee_name,
                    course_name=course_name,
                    cert_number=cert_number,
                    completion_date=completion_date,
                    template=template,
                )
            except Exception:
                logger.exception(
                    "Unable to use ready-made certificate template: %s",
                    template.template_file_path,
                )

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
                logo_bytes = io.BytesIO(read_file(CERT_BUCKET, template.logo_path))
                story.append(
                    Image(
                        logo_bytes,
                        width=3 * cm,
                        height=2 * cm,
                    )
                )
                story.append(Spacer(1, 0.3 * cm))
            except Exception:
                logger.exception("Unable to embed certificate logo: %s", template.logo_path)
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
                signature_bytes = io.BytesIO(read_file(CERT_BUCKET, template.signature_path))
                story.append(
                    Image(
                        signature_bytes,
                        width=4 * cm,
                        height=1.5 * cm,
                    )
                )
                story.append(Spacer(1, 0.2 * cm))
            except Exception:
                logger.exception(
                    "Unable to embed certificate signature: %s", template.signature_path
                )
        story.append(Paragraph(f"Certificate Number: {cert_number}", small_style))
        story.append(
            Paragraph(
                f"Verify at: {self._verification_url(cert_number)}",
                small_style,
            )
        )

        doc.build(story)
        buf.seek(0)
        return buf.read()

    def _generate_pdf_from_ready_template(
        self,
        employee_name: str,
        course_name: str,
        cert_number: str,
        completion_date: date,
        template: CertificateTemplate,
    ) -> bytes:
        template_bytes = read_file(CERT_BUCKET, template.template_file_path)
        object_key = template.template_file_path.lower()
        if object_key.endswith(".pdf"):
            return self._merge_overlay_with_template_pdf(
                template_bytes,
                employee_name,
                course_name,
                cert_number,
                completion_date,
                template,
            )
        if object_key.endswith((".png", ".jpg", ".jpeg")):
            return self._render_template_image_pdf(
                template_bytes,
                employee_name,
                course_name,
                cert_number,
                completion_date,
                template,
            )
        raise HTTPException(400, "Ready-made certificate template must be PDF, PNG, JPG, or JPEG.")

    def _template_overlay_pdf(
        self,
        width: float,
        height: float,
        employee_name: str,
        course_name: str,
        cert_number: str,
        completion_date: date,
        template: CertificateTemplate,
    ) -> bytes:
        overlay = io.BytesIO()
        c = canvas.Canvas(overlay, pagesize=(width, height))
        brand_color = template.color_code or "#1a3c5e"
        font_name = template.font_name or "Helvetica"
        try:
            c.setFillColor(colors.HexColor(brand_color))
        except Exception:
            c.setFillColor(colors.HexColor("#1a3c5e"))

        def cover_centered(x_center: float, y_center: float, box_width: float, box_height: float):
            c.saveState()
            c.setFillColor(colors.white)
            c.rect(
                x_center - box_width / 2,
                y_center - box_height / 2,
                box_width,
                box_height,
                stroke=0,
                fill=1,
            )
            c.restoreState()

        name_y = height * 0.50
        sentence_placeholder_y = height * 0.445
        sentence_text_y = height * 0.385
        certificate_no_placeholder_y = height * 0.355
        certificate_no_text_y = height * 0.13

        cover_centered(width / 2, name_y, width * 0.46, 52)
        cover_centered(width / 2, sentence_placeholder_y, width * 0.74, 74)
        cover_centered(width / 2, certificate_no_placeholder_y, width * 0.42, 36)

        try:
            c.setFillColor(colors.HexColor(brand_color))
        except Exception:
            c.setFillColor(colors.HexColor("#1a3c5e"))
        c.setFont(font_name, 28)
        c.drawCentredString(width / 2, name_y - 8, employee_name)
        c.setFillColor(colors.HexColor("#1f2430"))
        c.setFont(font_name, 13)
        c.drawCentredString(
            width / 2,
            sentence_text_y,
            f"has successfully completed {course_name} on {completion_date.strftime('%d %B %Y')}.",
        )
        c.setFillColor(colors.HexColor("#1f2430"))
        c.setFont(font_name, 10)
        c.drawCentredString(width / 2, certificate_no_text_y, cert_number)
        c.save()
        overlay.seek(0)
        return overlay.read()

    def _merge_overlay_with_template_pdf(
        self,
        template_bytes: bytes,
        employee_name: str,
        course_name: str,
        cert_number: str,
        completion_date: date,
        template: CertificateTemplate,
    ) -> bytes:
        reader = PdfReader(io.BytesIO(template_bytes))
        if not reader.pages:
            raise HTTPException(400, "Ready-made certificate template PDF has no pages.")
        template_page = reader.pages[0]
        width = float(template_page.mediabox.width)
        height = float(template_page.mediabox.height)
        overlay_reader = PdfReader(
            io.BytesIO(
                self._template_overlay_pdf(
                    width,
                    height,
                    employee_name,
                    course_name,
                    cert_number,
                    completion_date,
                    template,
                )
            )
        )
        template_page.merge_page(overlay_reader.pages[0])
        writer = PdfWriter()
        writer.add_page(template_page)
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    def _render_template_image_pdf(
        self,
        template_bytes: bytes,
        employee_name: str,
        course_name: str,
        cert_number: str,
        completion_date: date,
        template: CertificateTemplate,
    ) -> bytes:
        width, height = landscape(A4)
        out = io.BytesIO()
        c = canvas.Canvas(out, pagesize=(width, height))
        c.drawImage(ImageReader(io.BytesIO(template_bytes)), 0, 0, width=width, height=height)
        c.save()
        overlay_reader = PdfReader(
            io.BytesIO(
                self._image_template_overlay_pdf(
                    width,
                    height,
                    employee_name,
                    course_name,
                    cert_number,
                    completion_date,
                    template,
                )
            )
        )
        overlay_page = overlay_reader.pages[0]
        base_reader = PdfReader(io.BytesIO(out.getvalue()))
        base_page = base_reader.pages[0]
        base_page.merge_page(overlay_page)
        writer = PdfWriter()
        writer.add_page(base_page)
        merged = io.BytesIO()
        writer.write(merged)
        return merged.getvalue()

    def _image_template_overlay_pdf(
        self,
        width: float,
        height: float,
        employee_name: str,
        course_name: str,
        cert_number: str,
        completion_date: date,
        template: CertificateTemplate,
    ) -> bytes:
        """Overlay only dynamic values on image templates; keep the uploaded design intact."""
        overlay = io.BytesIO()
        c = canvas.Canvas(overlay, pagesize=(width, height))
        brand_color = template.color_code or "#1a3c5e"
        font_name = template.font_name or "Helvetica"
        try:
            c.setFillColor(colors.HexColor(brand_color))
        except Exception:
            c.setFillColor(colors.HexColor("#1a3c5e"))

        c.setFont(font_name, 26)
        c.drawCentredString(width / 2, height * 0.455, employee_name)
        c.setFillColor(colors.HexColor("#1f2430"))
        c.setFont(font_name, 8)
        c.drawCentredString(
            width / 2,
            height * 0.08,
            f"Certificate No: {cert_number} | Date: {completion_date.strftime('%d %B %Y')}",
        )
        c.save()
        overlay.seek(0)
        return overlay.read()

    def _verification_url(self, cert_number: str) -> str:
        """Return the public frontend verification page for a certificate."""
        return f"{settings.PUBLIC_APP_URL.rstrip('/')}/certificates/verify/{cert_number}"

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

        template_result = await db.execute(
            select(CertificateTemplate)
            .where(
                CertificateTemplate.company_id == cert.company_id,
                CertificateTemplate.status == "Active",
            )
            .order_by(
                case((CertificateTemplate.template_file_path.is_not(None), 0), else_=1),
                CertificateTemplate.updated_date.desc(),
                CertificateTemplate.template_id.desc(),
            )
            .limit(1)
        )
        template = template_result.scalar_one_or_none()
        if cert.video_id and template and (
            cert.template_id != template.template_id or template.template_file_path
        ):
            user_result = await db.execute(
                select(UserMaster).where(UserMaster.user_id == cert.user_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                employee_name = f"{user.first_name} {user.last_name or ''}".strip()
                pdf_bytes = self._generate_pdf(
                    employee_name=employee_name,
                    course_name=cert.course_name,
                    cert_number=cert.certificate_number,
                    completion_date=cert.completion_date or date.today(),
                    template=template,
                )
                pdf_path = (
                    cert.pdf_path
                    or f"certificates/{cert.company_id}/pdf/{cert.certificate_number}.pdf"
                )
                upload_file(pdf_bytes, CERT_BUCKET, pdf_path, "application/pdf")
                cert.pdf_path = pdf_path
                cert.template_id = template.template_id
                await db.commit()

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

    async def list_templates(self, db, company_id: Optional[int]) -> list:
        filters = []
        if company_id is not None:
            filters.append(CertificateTemplate.company_id == company_id)
        result = await db.execute(
            select(CertificateTemplate)
            .where(*filters)
            .order_by(CertificateTemplate.created_date.desc())
        )
        return result.scalars().all()

    async def create_template(
        self, db, data, company_id: int, initial_status: str = "Pending"
    ) -> CertificateTemplate:
        template = CertificateTemplate(
            template_name=data.template_name.strip(),
            font_name=data.font_name or "Helvetica",
            color_code=data.color_code or "#1a3c5e",
            company_id=company_id,
            status=initial_status,
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        return template

    async def _get_template(
        self, db, template_id: int, company_id: Optional[int]
    ) -> CertificateTemplate:
        filters = [CertificateTemplate.template_id == template_id]
        if company_id is not None:
            filters.append(CertificateTemplate.company_id == company_id)
        result = await db.execute(
            select(CertificateTemplate).where(*filters)
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(404, "Certificate template not found.")
        return template

    async def update_template(
        self,
        db,
        template_id: int,
        data,
        company_id: Optional[int],
        require_reapproval: bool = False,
    ):
        template = await self._get_template(db, template_id, company_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "status":
                continue
            setattr(template, field, value)
        if require_reapproval:
            template.status = "Pending"
        await db.commit()
        await db.refresh(template)
        return template

    async def set_template_status(
        self, db, template_id: int, new_status: str, company_id: Optional[int]
    ) -> dict:
        template = await self._get_template(db, template_id, company_id)
        if new_status == "Active":
            await db.execute(
                update(CertificateTemplate)
                .where(
                    CertificateTemplate.company_id == template.company_id,
                    CertificateTemplate.template_id != template.template_id,
                    CertificateTemplate.status == "Active",
                )
                .values(status="Inactive")
            )
        template.status = new_status
        await db.commit()
        return {"message": f"Template {new_status.lower()} successfully."}

    async def upload_template_asset(
        self,
        db,
        template_id: int,
        company_id: Optional[int],
        file,
        asset_type: str,
        require_reapproval: bool = False,
    ) -> CertificateTemplate:
        if asset_type not in ["logo", "signature", "template"]:
            raise HTTPException(400, "asset_type must be logo, signature, or template.")
        template = await self._get_template(db, template_id, company_id)

        file_bytes = await file.read()
        extension = (file.filename or f"{asset_type}.png").split(".")[-1].lower()
        object_key = (
            f"certificate-templates/{template.company_id}/{template_id}/{asset_type}.{extension}"
        )
        upload_file(
            file_bytes,
            CERT_BUCKET,
            object_key,
            file.content_type or "application/octet-stream",
        )

        if asset_type == "logo":
            template.logo_path = object_key
        elif asset_type == "signature":
            template.signature_path = object_key
        else:
            template.template_file_path = object_key
        if require_reapproval:
            template.status = "Pending"
        elif asset_type == "template":
            await db.execute(
                update(CertificateTemplate)
                .where(
                    CertificateTemplate.company_id == template.company_id,
                    CertificateTemplate.template_id != template.template_id,
                    CertificateTemplate.status == "Active",
                )
                .values(status="Inactive")
            )
            template.status = "Active"
        await db.commit()
        await db.refresh(template)
        return template

    async def delete_template(
        self,
        db,
        template_id: int,
        company_id: Optional[int],
        allow_active_delete: bool = False,
    ) -> dict:
        template = await self._get_template(db, template_id, company_id)
        if template.status == "Active" and not allow_active_delete:
            raise HTTPException(403, "Approved certificate templates can only be deleted by Super Admin.")
        template_company_id = template.company_id

        replacement_result = await db.execute(
            select(CertificateTemplate)
            .where(
                CertificateTemplate.company_id == template_company_id,
                CertificateTemplate.template_id != template_id,
                CertificateTemplate.status == "Active",
            )
            .order_by(
                CertificateTemplate.updated_date.desc(),
                CertificateTemplate.template_id.desc(),
            )
            .limit(1)
        )
        replacement_template = replacement_result.scalar_one_or_none()
        replacement_template_id = replacement_template.template_id if replacement_template else None

        regenerated_count = 0
        if replacement_template:
            certificate_result = await db.execute(
                select(Certificate, UserMaster)
                .join(UserMaster, Certificate.user_id == UserMaster.user_id)
                .where(
                    Certificate.template_id == template_id,
                    Certificate.company_id == template_company_id,
                    Certificate.status == "Valid",
                )
            )
            for certificate, user in certificate_result.all():
                employee_name = f"{user.first_name} {user.last_name or ''}".strip()
                pdf_bytes = self._generate_pdf(
                    employee_name=employee_name,
                    course_name=certificate.course_name,
                    cert_number=certificate.certificate_number,
                    completion_date=certificate.completion_date or date.today(),
                    template=replacement_template,
                )
                pdf_path = (
                    certificate.pdf_path
                    or f"certificates/{template_company_id}/pdf/{certificate.certificate_number}.pdf"
                )
                upload_file(pdf_bytes, CERT_BUCKET, pdf_path, "application/pdf")
                certificate.pdf_path = pdf_path
                certificate.template_id = replacement_template_id
                regenerated_count += 1

        await db.execute(
            update(Certificate)
            .where(
                Certificate.template_id == template_id,
                Certificate.company_id == template_company_id,
            )
            .values(template_id=replacement_template_id)
        )

        await db.execute(
            delete(CertificateTemplate).where(
                CertificateTemplate.template_id == template_id,
                CertificateTemplate.company_id == template_company_id,
            )
        )
        await db.commit()
        for object_key in [
            template.logo_path,
            template.signature_path,
            template.template_file_path,
        ]:
            if object_key:
                try:
                    delete_file(CERT_BUCKET, object_key)
                except Exception:
                    logger.exception("Unable to delete certificate template file: %s", object_key)
        message = "Certificate template deleted."
        if replacement_template_id:
            message += (
                " Issued certificates now use the latest active template."
                f" Regenerated {regenerated_count} certificate PDF(s)."
            )
        return {
            "message": message,
            "deleted": True,
            "replacement_template_id": replacement_template_id,
            "regenerated_certificates": regenerated_count,
        }
