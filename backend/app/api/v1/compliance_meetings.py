import io
import json
import logging
import os
import secrets
from datetime import date, datetime, time
from typing import Literal

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.v1.compliance import MAX_BYTES, edit_access, ensure_company, validate_pdf, view_access
from app.core.storage import delete_file, read_file, upload_file
from app.db.session import get_db
from app.models.company import CompanyMaster
from app.models.compliance import NoticeDisplay, QuarterlyMeeting
from app.schemas.input_validation import person_name

router = APIRouter(
    prefix="/hr/compliance/companies/{company_id}", tags=["POSH Notices and Meetings"]
)
BUCKET = (
    os.environ.get("MINIO_BUCKET_MEETINGS")
    or os.environ.get("MINIO_BUCKET_CERTIFICATES")
    or "posh-meeting-documents"
)
logger = logging.getLogger(__name__)


async def upload_meeting_document(content, key, content_type):
    try:
        await run_in_threadpool(upload_file, content, BUCKET, key, content_type)
    except (BotoCoreError, ClientError) as exc:
        logger.exception("Meeting document storage upload failed")
        raise HTTPException(
            503,
            "Meeting document storage is unavailable. Check the backend storage endpoint, "
            "credentials, region, and MINIO_BUCKET_MEETINGS configuration.",
        ) from exc


async def cleanup_meeting_document(key):
    try:
        await run_in_threadpool(delete_file, BUCKET, key)
    except Exception:
        logger.exception("Failed to clean up meeting document upload")


class NoticeInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    branch_id: str = Field(min_length=1, max_length=50)
    status: Literal["Pending", "Completed"]
    notes: str = Field(default="", max_length=2000)


class MeetingInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    branch_id: str = Field(min_length=1, max_length=50)
    year: int = Field(ge=2000, le=2100)
    quarter: int = Field(ge=1, le=4)
    meeting_date: date
    meeting_time: time
    presiding_officer: str = Field(min_length=1, max_length=150)
    venue: str = Field(min_length=1, max_length=500)
    attendees: str = Field(min_length=1, max_length=4000)
    agenda1: str = Field(default="", max_length=10000)
    agenda2: str = Field(default="", max_length=10000)
    agenda3: str = Field(default="", max_length=10000)
    agenda4: str = Field(default="", max_length=10000)
    agenda5: str = Field(default="", max_length=10000)

    @field_validator("presiding_officer")
    @classmethod
    def officer_name(cls, value):
        return person_name(value)

    @model_validator(mode="after")
    def validate_period(self):
        if (
            self.meeting_date.year != self.year
            or (self.meeting_date.month - 1) // 3 + 1 != self.quarter
        ):
            raise ValueError("Meeting date must fall within the selected year and quarter.")
        if self.meeting_time.tzinfo or self.meeting_time.second or self.meeting_time.microsecond:
            raise ValueError("Meeting time must be a local time in HH:MM format.")
        return self


def branches(company):
    try:
        rows = json.loads(company.branches_json or "[]")
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(409, "Branch Master data needs correction.")
    return [
        {"branch_id": str(row["branch_id"]), "branch_name": row["branch_name"]}
        for row in rows
        if row.get("branch_id") and row.get("branch_name")
    ]


def select_branch(company, branch_id):
    branch = next((row for row in branches(company) if row["branch_id"] == branch_id), None)
    if not branch:
        raise HTTPException(422, "Select a branch from this company's Branch Master.")
    return branch


def notice_data(row):
    return {
        key: getattr(row, key)
        for key in ("id", "branch_id", "branch_name", "status", "notes", "updated_at")
    }


def meeting_data(row):
    return {
        **{
            key: getattr(row, key)
            for key in (
                "id",
                "branch_id",
                "branch_name",
                "year",
                "quarter",
                "meeting_date",
                "meeting_time",
                "attendees",
            )
        },
        "has_photo": bool(row.photo_key),
        "has_signed_mom": bool(row.signed_key),
    }


@router.get("/notices")
async def list_notices(
    company_id: int, db: AsyncSession = Depends(get_db), user=Depends(view_access)
):
    company = await ensure_company(db, user, company_id)
    rows = (
        (
            await db.execute(
                select(NoticeDisplay)
                .where(NoticeDisplay.company_id == company_id)
                .order_by(NoticeDisplay.branch_name)
            )
        )
        .scalars()
        .all()
    )
    return {"branches": branches(company), "notices": [notice_data(row) for row in rows]}


@router.put("/notices")
async def save_notice(
    company_id: int,
    data: NoticeInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(edit_access),
):
    await ensure_company(db, user, company_id)
    # Lock the company to serialize inserts for the same branch.
    company = (
        await db.execute(
            select(CompanyMaster).where(CompanyMaster.company_id == company_id).with_for_update()
        )
    ).scalar_one()
    branch = select_branch(company, data.branch_id)
    row = (
        await db.execute(
            select(NoticeDisplay).where(
                NoticeDisplay.company_id == company_id, NoticeDisplay.branch_id == data.branch_id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = NoticeDisplay(company_id=company_id, branch_id=data.branch_id)
        db.add(row)
    row.branch_name = branch["branch_name"]
    row.status, row.notes, row.updated_by = data.status, data.notes, user.user_id
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return notice_data(row)


@router.get("/meetings")
async def list_meetings(
    company_id: int,
    branch_id: str | None = None,
    year: int | None = Query(None, ge=2000, le=2100),
    quarter: int | None = Query(None, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
    user=Depends(view_access),
):
    await ensure_company(db, user, company_id)
    query = select(QuarterlyMeeting).where(QuarterlyMeeting.company_id == company_id)
    for column, value in (
        (QuarterlyMeeting.branch_id, branch_id),
        (QuarterlyMeeting.year, year),
        (QuarterlyMeeting.quarter, quarter),
    ):
        if value is not None:
            query = query.where(column == value)
    rows = (
        (
            await db.execute(
                query.order_by(QuarterlyMeeting.meeting_date.desc(), QuarterlyMeeting.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return [meeting_data(row) for row in rows]


def normalize_photo(content):
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "Meeting photo must be 10 MB or smaller.")
    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.format not in ("JPEG", "PNG") or image.width * image.height > 20_000_000:
                raise ValueError()
            image.load()
            output = io.BytesIO()
            image.convert("RGB").save(output, format="JPEG", quality=90)
            return output.getvalue()
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        raise HTTPException(422, "Upload a valid JPEG or PNG photo, up to 20 megapixels.")


@router.post("/meetings", status_code=201)
async def create_meeting(
    company_id: int,
    payload: str = Form(..., max_length=60000),
    photo: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(edit_access),
):
    company = await ensure_company(db, user, company_id)
    try:
        data = MeetingInput.model_validate_json(payload)
    except ValidationError as error:
        raise HTTPException(422, error.errors(include_context=False, include_input=False))
    branch = select_branch(company, data.branch_id)
    key = None
    if photo:
        content = await photo.read(MAX_BYTES + 1)
        await photo.close()
        content = await run_in_threadpool(normalize_photo, content)
        key = f"{company_id}/{secrets.token_hex(20)}.jpg"
        await upload_meeting_document(content, key, "image/jpeg")
    row = QuarterlyMeeting(
        company_id=company_id,
        branch_name=branch["branch_name"],
        created_by=user.user_id,
        photo_key=key,
        **data.model_dump(),
    )
    db.add(row)
    try:
        await db.commit()
    except Exception as error:
        await db.rollback()
        if key:
            await cleanup_meeting_document(key)
        if isinstance(error, IntegrityError):
            raise HTTPException(409, "A meeting already exists for this branch, year and quarter.")
        raise
    await db.refresh(row)
    return meeting_data(row)


async def scoped_meeting(db, user, company_id, meeting_id):
    await ensure_company(db, user, company_id)
    row = (
        await db.execute(
            select(QuarterlyMeeting)
            .where(QuarterlyMeeting.company_id == company_id, QuarterlyMeeting.id == meeting_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Meeting not found.")
    return row


@router.get("/meetings/{meeting_id}")
async def meeting_detail(
    company_id: int, meeting_id: int, db: AsyncSession = Depends(get_db), user=Depends(view_access)
):
    row = await scoped_meeting(db, user, company_id, meeting_id)
    company = await ensure_company(db, user, company_id)
    return {
        **meeting_data(row),
        **{key: getattr(row, key) for key in MeetingInput.model_fields},
        "company_name": company.company_name,
    }


@router.put("/meetings/{meeting_id}")
async def update_meeting(
    company_id: int,
    meeting_id: int,
    payload: str = Form(..., max_length=60000),
    photo: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(edit_access),
):
    row = await scoped_meeting(db, user, company_id, meeting_id)
    try:
        data = MeetingInput.model_validate_json(payload)
    except ValidationError as error:
        raise HTTPException(422, error.errors(include_context=False, include_input=False))
    company = await ensure_company(db, user, company_id)
    branch = select_branch(company, data.branch_id)
    key = None
    if photo:
        content = await photo.read(MAX_BYTES + 1)
        await photo.close()
        content = await run_in_threadpool(normalize_photo, content)
        key = f"{company_id}/{secrets.token_hex(20)}.jpg"
        await upload_meeting_document(content, key, "image/jpeg")
    for field, value in data.model_dump().items():
        setattr(row, field, value)
    row.branch_name = branch["branch_name"]
    if key:
        row.photo_key = key
    try:
        await db.commit()
    except Exception as error:
        await db.rollback()
        if key:
            await cleanup_meeting_document(key)
        if isinstance(error, IntegrityError):
            raise HTTPException(409, "A meeting already exists for this branch, year and quarter.")
        raise
    await db.refresh(row)
    return meeting_data(row)


@router.post("/meetings/{meeting_id}/signed")
async def upload_signed(
    company_id: int,
    meeting_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(edit_access),
):
    row = await scoped_meeting(db, user, company_id, meeting_id)
    if row.signed_key:
        raise HTTPException(409, "Signed minutes have already been uploaded.")
    content = await file.read(MAX_BYTES + 1)
    await file.close()
    filename = (file.filename or "").replace("\\", "/").split("/")[-1]
    if len(filename) > 200:
        raise HTTPException(422, "File name is too long.")
    await run_in_threadpool(validate_pdf, content, filename)
    key = f"{company_id}/{secrets.token_hex(20)}.pdf"
    await upload_meeting_document(content, key, "application/pdf")
    row.signed_key, row.signed_filename = key, filename
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        await cleanup_meeting_document(key)
        raise
    return meeting_data(row)


@router.get("/meetings/{meeting_id}/documents/{kind}")
async def meeting_document(
    company_id: int,
    meeting_id: int,
    kind: Literal["photo", "signed"],
    db: AsyncSession = Depends(get_db),
    user=Depends(view_access),
):
    row = await scoped_meeting(db, user, company_id, meeting_id)
    key = row.photo_key if kind == "photo" else row.signed_key
    if not key:
        raise HTTPException(404, "Document not uploaded.")
    content = await run_in_threadpool(read_file, BUCKET, key)
    return Response(
        content,
        media_type="image/jpeg" if kind == "photo" else "application/pdf",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
        },
    )
