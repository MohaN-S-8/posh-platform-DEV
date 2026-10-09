import hashlib
import html
import io
import logging
import os
import re
import secrets
from datetime import datetime, timedelta
from pathlib import PurePath

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.company_scope import assigned_company_ids
from app.core.dependencies import require_roles_with_matrix
from app.core.email import FRONTEND_URL, send_email
from app.core.storage import delete_file, read_file, upload_file
from app.db.session import get_db
from app.models.company import CompanyMaster
from app.models.compliance import ConstitutionLetter, ExternalMember
from app.schemas.input_validation import person_name

router = APIRouter(prefix="/hr/compliance", tags=["POSH Compliance"])
view_access = require_roles_with_matrix([1, 2, 3, 5], ["POSH Compliance"])
edit_access = require_roles_with_matrix([1, 2, 5], ["POSH Compliance"])
BUCKET = (
    os.environ.get("MINIO_BUCKET_CONSTITUTION_LETTERS")
    or os.environ.get("MINIO_BUCKET_CERTIFICATES")
    or "posh-constitution-letters"
)
logger = logging.getLogger(__name__)
MAX_BYTES = 10 * 1024 * 1024


class MemberInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=1, max_length=150)
    organization: str = Field(default="", max_length=200)
    designation: str = Field(min_length=1, max_length=150)
    location: str = Field(default="", max_length=150)
    contact: str = Field(default="", max_length=25)
    email: EmailStr = Field(max_length=254)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        return person_name(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value):
        if value and (
            not re.fullmatch(r"\+?[0-9 ()-]+", value)
            or not 7 <= len(re.sub(r"\D", "", value)) <= 15
        ):
            raise ValueError("Enter a contact number containing 7 to 15 digits.")
        return value


class ApprovalInput(BaseModel):
    token: str = Field(min_length=40, max_length=100)


async def ensure_company(db, user, company_id):
    if company_id not in await assigned_company_ids(db, user):
        raise HTTPException(403, "This company is outside your access scope.")
    company = await db.get(CompanyMaster, company_id)
    if not company or company.is_deleted == "Y":
        raise HTTPException(404, "Company not found.")
    return company


def member_data(row):
    return {
        key: getattr(row, key)
        for key in ("id", "name", "organization", "designation", "location", "contact", "email")
    }


def letter_data(row):
    return {
        key: getattr(row, key)
        for key in (
            "id",
            "title",
            "filename",
            "approver_name",
            "approver_email",
            "submitted_at",
            "status",
            "delivery_status",
            "approved_at",
        )
    }


@router.get("/companies")
async def companies(db: AsyncSession = Depends(get_db), user=Depends(view_access)):
    ids = await assigned_company_ids(db, user)
    rows = (
        (
            await db.execute(
                select(CompanyMaster).where(
                    CompanyMaster.company_id.in_(ids), CompanyMaster.is_deleted == "N"
                )
            )
        )
        .scalars()
        .all()
    )
    return [{"company_id": row.company_id, "company_name": row.company_name} for row in rows]


@router.get("/companies/{company_id}/constitution")
async def overview(company_id: int, db: AsyncSession = Depends(get_db), user=Depends(view_access)):
    await ensure_company(db, user, company_id)
    members = (
        (
            await db.execute(
                select(ExternalMember)
                .where(ExternalMember.company_id == company_id)
                .order_by(ExternalMember.name)
            )
        )
        .scalars()
        .all()
    )
    letters = (
        (
            await db.execute(
                select(ConstitutionLetter)
                .where(ConstitutionLetter.company_id == company_id)
                .order_by(ConstitutionLetter.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return {
        "members": [member_data(row) for row in members],
        "letters": [letter_data(row) for row in letters],
    }


@router.post("/companies/{company_id}/members", status_code=201)
async def add_member(
    company_id: int,
    data: MemberInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(edit_access),
):
    await ensure_company(db, user, company_id)
    row = ExternalMember(company_id=company_id, **data.model_dump())
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            409, "An external member with this email already exists for this company."
        )
    await db.refresh(row)
    return member_data(row)


@router.delete("/companies/{company_id}/members/{member_id}")
async def remove_member(
    company_id: int, member_id: int, db: AsyncSession = Depends(get_db), user=Depends(edit_access)
):
    await ensure_company(db, user, company_id)
    member = (
        await db.execute(
            select(ExternalMember)
            .where(ExternalMember.id == member_id, ExternalMember.company_id == company_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "External member not found.")
    if (
        await db.execute(
            select(ConstitutionLetter.id).where(ConstitutionLetter.member_id == member_id).limit(1)
        )
    ).first():
        raise HTTPException(
            409, "This member is referenced by a constitution letter and cannot be deleted."
        )
    await db.delete(member)
    await db.commit()
    return {"message": "External member deleted."}


def validate_pdf(content, filename):
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "PDF must be 10 MB or smaller.")
    if not filename.lower().endswith(".pdf") or not content.startswith(b"%PDF-"):
        raise HTTPException(422, "Upload a valid PDF document.")
    try:
        pdf = PdfReader(io.BytesIO(content))
        if pdf.is_encrypted or not len(pdf.pages):
            raise ValueError("Encrypted or empty PDF")
    except Exception:
        raise HTTPException(422, "PDF is unreadable, empty, or password protected.")


async def route_email(db, letter):
    token = secrets.token_urlsafe(32)
    letter.token_hash = hashlib.sha256(token.encode()).hexdigest()
    letter.token_expires_at = datetime.utcnow() + timedelta(days=7)
    letter.reviewed_at = None
    letter.delivery_status = "Pending"
    await db.commit()
    url = f"{FRONTEND_URL.rstrip('/')}/constitution-approval#token={token}"
    try:
        await send_email(
            letter.approver_email,
            "IC Constitution Letter - Approval Required",
            f'<p>Dear {html.escape(letter.approver_name)},</p><p>A management approval letter is ready for your review.</p><p><a href="{html.escape(url, quote=True)}">Review and approve the letter</a></p><p>This private link expires in 7 days. Do not forward it.</p>',
        )
        letter.delivery_status = "Sent"
    except Exception:
        letter.delivery_status = "Failed"
    await db.commit()
    return letter_data(letter)


@router.post("/companies/{company_id}/letters", status_code=201)
async def submit_letter(
    company_id: int,
    member_id: int = Form(...),
    title: str = Form("", max_length=200),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(edit_access),
):
    await ensure_company(db, user, company_id)
    member = (
        await db.execute(
            select(ExternalMember)
            .where(ExternalMember.id == member_id, ExternalMember.company_id == company_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(422, "Select an external member belonging to this company.")
    content = await file.read(MAX_BYTES + 1)
    await file.close()
    filename = PurePath((file.filename or "").replace("\\", "/")).name
    if not filename or len(filename) > 200:
        raise HTTPException(422, "File name must contain 1 to 200 characters.")
    await run_in_threadpool(validate_pdf, content, filename)
    key = f"{company_id}/{secrets.token_hex(20)}.pdf"
    try:
        await run_in_threadpool(upload_file, content, BUCKET, key, "application/pdf")
    except (BotoCoreError, ClientError) as exc:
        logger.exception("Constitution letter storage upload failed for company %s", company_id)
        raise HTTPException(
            503,
            "Constitution letter storage is unavailable. Check the backend storage endpoint, "
            "credentials, region, and MINIO_BUCKET_CONSTITUTION_LETTERS configuration.",
        ) from exc
    letter = ConstitutionLetter(
        company_id=company_id,
        member_id=member.id,
        title=title.strip(),
        filename=filename,
        object_key=key,
        approver_name=member.name,
        approver_email=member.email,
        submitted_by=user.user_id,
        token_expires_at=datetime.utcnow(),
    )
    db.add(letter)
    try:
        await db.commit()
        await db.refresh(letter)
    except Exception:
        await db.rollback()
        try:
            await run_in_threadpool(delete_file, BUCKET, key)
        except Exception:
            logger.exception(
                "Failed to clean up constitution letter upload for company %s", company_id
            )
        raise
    return await route_email(db, letter)


async def scoped_letter(db, user, company_id, letter_id):
    await ensure_company(db, user, company_id)
    row = (
        await db.execute(
            select(ConstitutionLetter)
            .where(ConstitutionLetter.id == letter_id, ConstitutionLetter.company_id == company_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Letter not found.")
    return row


@router.post("/companies/{company_id}/letters/{letter_id}/resend")
async def resend(
    company_id: int, letter_id: int, db: AsyncSession = Depends(get_db), user=Depends(edit_access)
):
    row = await scoped_letter(db, user, company_id, letter_id)
    if row.status != "Pending":
        raise HTTPException(409, "Completed letters are locked.")
    return await route_email(db, row)


async def pdf_response(row):
    content = await run_in_threadpool(read_file, BUCKET, row.object_key)
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="constitution-letter.pdf"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/companies/{company_id}/letters/{letter_id}/file")
async def view_file(
    company_id: int, letter_id: int, db: AsyncSession = Depends(get_db), user=Depends(view_access)
):
    return await pdf_response(await scoped_letter(db, user, company_id, letter_id))


async def token_letter(db, token):
    row = (
        await db.execute(
            select(ConstitutionLetter)
            .where(ConstitutionLetter.token_hash == hashlib.sha256(token.encode()).hexdigest())
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not row or row.status != "Pending" or row.token_expires_at <= datetime.utcnow():
        raise HTTPException(410, "Approval link is invalid, expired, or already used.")
    return row


@router.post("/approval/review")
async def external_review(data: ApprovalInput, db: AsyncSession = Depends(get_db)):
    row = await token_letter(db, data.token)
    return {"title": row.title, "filename": row.filename, "approver_name": row.approver_name}


@router.post("/approval/file")
async def external_file(data: ApprovalInput, db: AsyncSession = Depends(get_db)):
    row = await token_letter(db, data.token)
    response = await pdf_response(row)
    row.reviewed_at = datetime.utcnow()
    await db.commit()
    return response


@router.post("/approval/approve")
async def external_approve(data: ApprovalInput, db: AsyncSession = Depends(get_db)):
    row = await token_letter(db, data.token)
    if row.reviewed_at is None:
        raise HTTPException(409, "View the letter before approving it.")
    row.status = "Completed"
    row.approved_at = datetime.utcnow()
    row.token_hash = None
    await db.commit()
    return {"message": "Letter approved. This record is now completed and locked."}
