import json
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_roles
from app.core.storage import generate_presigned_url, upload_file
from app.db.session import get_db
from app.models.policy import PoshPolicy
from app.schemas.policy import PoshPolicyPayload
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/policy", tags=["PoSH Policy"])
POLICY_BUCKET = "posh-policy-documents"


DEFAULT_POLICY = {
    "title": "Prevention, prohibition, and redressal at work.",
    "overview": (
        "This policy protects women employees against sexual harassment at the "
        "workplace and sets out mechanisms for prevention, prohibition, and "
        "redressal in line with the Sexual Harassment of Women at Workplace Act, 2013."
    ),
    "version": "3.2",
    "approved_date": "04 Jan 2026",
    "harassment_types": [
        {
            "title": "Physical",
            "text": "Unwelcome touching, patting, hugging, physical contact, or physical advances.",
        },
        {
            "title": "Verbal",
            "text": "Sexual remarks, jokes, comments on appearance, or requests for favours.",
        },
        {
            "title": "Non-Verbal",
            "text": "Staring, suggestive gestures, or displaying explicit material.",
        },
        {
            "title": "Digital",
            "text": "Sexually explicit messages, emails, images, or online communication.",
        },
    ],
    "committee_members": [
        {
            "role": "Presiding Officer",
            "name": "Gomathi Subramaniam",
            "detail": "Senior Manager - HR, Chennai HQ",
        },
        {
            "role": "Member",
            "name": "Priya Raman",
            "detail": "HR Business Partner, Chennai HQ",
        },
        {
            "role": "Member",
            "name": "Arjun Mehta",
            "detail": "Legal Counsel, Chennai HQ",
        },
        {
            "role": "External Member",
            "name": "Kavitha Reddy",
            "detail": "Sakhi Foundation",
        },
    ],
    "rights": [
        "Right to a safe workplace",
        "Right to file a complaint in confidence",
        "Protection from retaliation",
        "Identity of parties kept confidential under Section 16",
    ],
    "faqs": [
        {
            "question": "Who can file a complaint?",
            "answer": "Any woman employee, including contractors, interns and visitors, who has experienced sexual harassment at the workplace.",
        },
        {
            "question": "Can a man file a complaint?",
            "answer": "The PoSH Act specifically protects women; all employees can escalate other workplace misconduct through HR's general grievance channel.",
        },
        {
            "question": "What if the respondent is a senior leader?",
            "answer": "The Internal Committee process applies equally regardless of seniority, including to the employer.",
        },
    ],
}


def _decode_json(value, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _serialize(policy: PoshPolicy | None):
    if not policy:
        return {"policy_id": None, "company_id": None, **DEFAULT_POLICY}
    return {
        "policy_id": policy.policy_id,
        "company_id": policy.company_id,
        "title": policy.title or DEFAULT_POLICY["title"],
        "overview": policy.overview or DEFAULT_POLICY["overview"],
        "version": policy.version or DEFAULT_POLICY["version"],
        "approved_date": policy.approved_date or DEFAULT_POLICY["approved_date"],
        "document_path": policy.document_path,
        "document_name": policy.document_name,
        "harassment_types": _decode_json(
            policy.harassment_types_json, DEFAULT_POLICY["harassment_types"]
        ),
        "committee_members": _decode_json(
            policy.committee_members_json, DEFAULT_POLICY["committee_members"]
        ),
        "rights": _decode_json(policy.rights_json, DEFAULT_POLICY["rights"]),
        "faqs": _decode_json(policy.faqs_json, DEFAULT_POLICY["faqs"]),
    }


async def _policy_for_user(db: AsyncSession, current_user):
    company_id = None if current_user.role_id == 1 else current_user.company_id
    if company_id is not None:
        company_result = await db.execute(
            select(PoshPolicy).where(PoshPolicy.company_id == company_id)
        )
        company_policy = company_result.scalar_one_or_none()
        if company_policy:
            return company_policy
    global_result = await db.execute(select(PoshPolicy).where(PoshPolicy.company_id.is_(None)))
    return global_result.scalar_one_or_none()


@router.get("/")
async def get_policy(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _serialize(await _policy_for_user(db, current_user))


@router.put("/")
async def update_policy(
    data: PoshPolicyPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2])),
):
    company_id = None if current_user.role_id == 1 else current_user.company_id
    result = await db.execute(select(PoshPolicy).where(PoshPolicy.company_id == company_id))
    policy = result.scalar_one_or_none()
    if not policy:
        policy = PoshPolicy(company_id=company_id)
        db.add(policy)

    policy.title = data.title.strip()
    policy.overview = data.overview.strip()
    policy.version = data.version.strip()
    policy.approved_date = data.approved_date.strip()
    policy.harassment_types_json = json.dumps([item.model_dump() for item in data.harassment_types])
    policy.committee_members_json = json.dumps(
        [item.model_dump() for item in data.committee_members]
    )
    policy.rights_json = json.dumps([item.strip() for item in data.rights if item.strip()])
    policy.faqs_json = json.dumps([item.model_dump() for item in data.faqs])
    policy.updated_by = current_user.user_id
    await db.flush()
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=company_id,
        action="POSH_POLICY_UPDATED",
        table_name="posh_policy",
        record_id=policy.policy_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(policy)
    return _serialize(policy)


@router.post("/document")
async def upload_policy_document(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles([1, 2])),
):
    filename = file.filename or "posh-policy.pdf"
    extension = os.path.splitext(filename)[1].lower()
    if extension != ".pdf" or file.content_type not in {
        "application/pdf",
        "application/octet-stream",
    }:
        raise HTTPException(400, "Please upload a PDF policy document.")

    company_id = None if current_user.role_id == 1 else current_user.company_id
    result = await db.execute(select(PoshPolicy).where(PoshPolicy.company_id == company_id))
    policy = result.scalar_one_or_none()
    if not policy:
        policy = PoshPolicy(company_id=company_id)
        db.add(policy)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "Uploaded policy document is empty.")
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "Policy document must be 10MB or smaller.")

    scope = "global" if company_id is None else f"company-{company_id}"
    object_key = f"{scope}/policy-{uuid.uuid4().hex}.pdf"
    upload_file(file_bytes, POLICY_BUCKET, object_key, "application/pdf")
    policy.document_path = object_key
    policy.document_name = filename
    policy.updated_by = current_user.user_id
    await db.flush()
    await write_audit_log(
        db,
        user_id=current_user.user_id,
        company_id=company_id,
        action="POSH_POLICY_DOCUMENT_UPLOADED",
        table_name="posh_policy",
        record_id=policy.policy_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(policy)
    return _serialize(policy)


@router.get("/document/download")
async def download_policy_document(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    policy = await _policy_for_user(db, current_user)
    if not policy or not policy.document_path:
        raise HTTPException(404, "Policy document has not been uploaded yet.")
    return {
        "download_url": generate_presigned_url(POLICY_BUCKET, policy.document_path),
        "file_name": policy.document_name or "posh-policy.pdf",
    }
