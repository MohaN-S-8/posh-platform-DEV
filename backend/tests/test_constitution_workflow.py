import io
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, UploadFile
from pydantic import ValidationError
from pypdf import PdfWriter
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.v1 import compliance as api
from app.db.base import Base
from app.models.company import CompanyMaster
from app.models.compliance import ConstitutionLetter, ExternalMember


class Adapter:
    def __init__(self, session):
        self.session = session

    async def execute(self, statement):
        return self.session.execute(statement)

    async def get(self, model, key):
        return self.session.get(model, key)

    def add(self, row):
        self.session.add(row)

    async def commit(self):
        self.session.commit()

    async def rollback(self):
        self.session.rollback()

    async def refresh(self, row):
        self.session.refresh(row)

    async def delete(self, row):
        self.session.delete(row)


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        session.add(CompanyMaster(company_id=2, company_code="ACME", company_name="Acme"))
        session.add(
            ExternalMember(
                id=1,
                company_id=2,
                name="External",
                designation="Advisor",
                email="external@example.com",
            )
        )
        session.add(
            ExternalMember(
                id=2, company_id=3, name="Other", designation="Advisor", email="other@example.com"
            )
        )
        session.commit()
        files = {}
        monkeypatch.setattr(
            api,
            "upload_file",
            lambda content, bucket, key, content_type: files.setdefault(key, content),
        )
        monkeypatch.setattr(api, "read_file", lambda bucket, key: files[key])
        mail = AsyncMock()
        monkeypatch.setattr(api, "send_email", mail)
        yield Adapter(session), SimpleNamespace(role_id=5, company_id=2, user_id=10), mail
    engine.dispose()


def pdf_bytes():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


async def submit(setup, member_id=1):
    db, user, mail = setup
    result = await api.submit_letter(
        2,
        member_id,
        "Constitution",
        UploadFile(filename="approval.pdf", file=io.BytesIO(pdf_bytes())),
        db,
        user,
    )
    token = mail.call_args.args[2].split("#token=")[1].split('"')[0]
    return result, api.ApprovalInput(token=token)


@pytest.mark.asyncio
async def test_submit_review_approve_and_lock(setup):
    db, user, _ = setup
    result, token = await submit(setup)
    assert result["status"] == "Pending"
    assert "token_hash" not in result
    assert result["delivery_status"] == "Sent"
    with pytest.raises(HTTPException) as error:
        await api.external_approve(token, db)
    assert error.value.status_code == 409
    await api.external_review(token, db)
    assert (await api.external_file(token, db)).body.startswith(b"%PDF")
    await api.external_approve(token, db)
    row = db.session.get(ConstitutionLetter, result["id"])
    assert row.status == "Completed" and row.approved_at and row.token_hash is None
    with pytest.raises(HTTPException):
        await api.external_approve(token, db)
    with pytest.raises(HTTPException):
        await api.resend(2, row.id, db, user)
    with pytest.raises(HTTPException):
        await api.remove_member(2, 1, db, user)


@pytest.mark.asyncio
async def test_company_isolation(setup):
    db, user, _ = setup
    with pytest.raises(HTTPException) as error:
        await api.overview(3, db, user)
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        await submit(setup, member_id=2)
    assert error.value.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_email_validation(setup):
    db, user, _ = setup
    with pytest.raises(HTTPException) as error:
        await api.add_member(
            2,
            api.MemberInput(name="Test", designation="Advisor", email="EXTERNAL@example.com"),
            db,
            user,
        )
    assert error.value.status_code == 409


@pytest.mark.asyncio
async def test_email_failure_keeps_submission_and_retry_rotates_token(setup):
    db, user, mail = setup
    mail.side_effect = RuntimeError("SMTP unavailable")
    result, old = await submit(setup)
    assert result["delivery_status"] == "Failed"
    mail.side_effect = None
    result = await api.resend(2, result["id"], db, user)
    assert result["delivery_status"] == "Sent"
    with pytest.raises(HTTPException):
        await api.external_review(old, db)


@pytest.mark.asyncio
async def test_expired_link(setup):
    db, _, _ = setup
    result, token = await submit(setup)
    row = db.session.get(ConstitutionLetter, result["id"])
    row.token_expires_at = datetime.utcnow() - timedelta(seconds=1)
    await db.commit()
    with pytest.raises(HTTPException) as error:
        await api.external_file(token, db)
    assert error.value.status_code == 410


@pytest.mark.parametrize(
    "changes",
    [
        {"name": "  "},
        {"designation": ""},
        {"email": "bad"},
        {"contact": "abc123"},
        {"contact": "123"},
    ],
)
def test_member_validation(changes):
    payload = {"name": "Member", "designation": "Advisor", "email": "member@example.com", **changes}
    with pytest.raises(ValidationError):
        api.MemberInput(**payload)


@pytest.mark.parametrize(
    "content,filename",
    [
        (b"bad", "test.pdf"),
        (b"%PDF-invalid", "test.pdf"),
        (b"%PDF-" + b"x" * api.MAX_BYTES, "test.pdf"),
        (b"%PDF-", "test.exe"),
    ],
    ids=["not-pdf", "corrupt", "too-large", "wrong-extension"],
)
def test_invalid_upload(content, filename):
    with pytest.raises(HTTPException):
        api.validate_pdf(content, filename)
