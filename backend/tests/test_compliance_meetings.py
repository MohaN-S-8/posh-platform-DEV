import importlib
import io
import json
from types import SimpleNamespace

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from fastapi import HTTPException, UploadFile
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.v1 import compliance_meetings as api
from app.db.base import Base
from app.models.company import CompanyMaster
from app.models.compliance import QuarterlyMeeting
from tests.test_constitution_workflow import Adapter, pdf_bytes


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        session.add(
            CompanyMaster(
                company_id=2,
                company_code="TEST",
                company_name="Test",
                branches_json=json.dumps([{"branch_id": "BR1", "branch_name": "Main"}]),
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
        monkeypatch.setattr(api, "delete_file", lambda bucket, key: files.pop(key, None))
        yield Adapter(session), SimpleNamespace(role_id=5, company_id=2, user_id=10), files
    engine.dispose()


def photo_file():
    image = io.BytesIO()
    Image.new("RGB", (10, 10)).save(image, format="PNG")
    return UploadFile(filename="proof.png", file=io.BytesIO(image.getvalue()))


def test_meeting_bucket_uses_production_configuration(monkeypatch):
    try:
        monkeypatch.delenv("MINIO_BUCKET_MEETINGS", raising=False)
        monkeypatch.setenv("MINIO_BUCKET_CERTIFICATES", "production-bucket")
        importlib.reload(api)
        assert api.BUCKET == "production-bucket"
        monkeypatch.setenv("MINIO_BUCKET_MEETINGS", "meeting-bucket")
        importlib.reload(api)
        assert api.BUCKET == "meeting-bucket"
        monkeypatch.delenv("MINIO_BUCKET_MEETINGS")
        monkeypatch.delenv("MINIO_BUCKET_CERTIFICATES")
        importlib.reload(api)
        assert api.BUCKET == "posh-meeting-documents"
    finally:
        monkeypatch.undo()
        importlib.reload(api)


@pytest.mark.asyncio
async def test_meeting_photo_and_signed_pdf_use_configured_bucket(setup, monkeypatch):
    db, user, _ = setup
    buckets = []
    original_upload = api.upload_file

    def upload(content, bucket, key, content_type):
        buckets.append(bucket)
        return original_upload(content, bucket, key, content_type)

    monkeypatch.setattr(api, "BUCKET", "production-bucket")
    monkeypatch.setattr(api, "upload_file", upload)
    result = await api.create_meeting(2, json.dumps(payload()), photo_file(), db, user)
    await api.update_meeting(2, result["id"], json.dumps(payload()), photo_file(), db, user)
    result = await api.upload_signed(
        2, result["id"], UploadFile(filename="signed.pdf", file=io.BytesIO(pdf_bytes())), db, user
    )
    assert buckets == ["production-bucket"] * 3
    assert result["has_photo"] and result["has_signed_mom"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "storage_error",
    [
        ClientError({"Error": {"Code": "AccessDenied"}}, "PutObject"),
        EndpointConnectionError(endpoint_url="https://storage.example"),
    ],
)
async def test_photo_failure_does_not_create_or_change_meeting(setup, monkeypatch, storage_error):
    db, user, _ = setup

    def fail_upload(*args):
        raise storage_error

    monkeypatch.setattr(api, "upload_file", fail_upload)
    with pytest.raises(HTTPException) as error:
        await api.create_meeting(2, json.dumps(payload()), photo_file(), db, user)
    assert error.value.status_code == 503
    assert "MINIO_BUCKET_MEETINGS" in error.value.detail
    assert db.session.query(QuarterlyMeeting).count() == 0
    saved = await api.create_meeting(2, json.dumps(payload()), None, db, user)
    with pytest.raises(HTTPException) as error:
        await api.update_meeting(
            2, saved["id"], json.dumps(payload(venue="Changed")), photo_file(), db, user
        )
    assert error.value.status_code == 503
    row = db.session.get(QuarterlyMeeting, saved["id"])
    assert row.venue == "Main office" and row.photo_key is None
    with pytest.raises(HTTPException) as error:
        await api.upload_signed(
            2,
            saved["id"],
            UploadFile(filename="signed.pdf", file=io.BytesIO(pdf_bytes())),
            db,
            user,
        )
    assert error.value.status_code == 503
    assert row.signed_key is None


def payload(**changes):
    return {
        "branch_id": "BR1",
        "year": 2026,
        "quarter": 1,
        "meeting_date": "2026-01-18",
        "meeting_time": "11:00",
        "presiding_officer": "Officer",
        "venue": "Main office",
        "attendees": "Member One",
        **changes,
    }


@pytest.mark.asyncio
async def test_notice_upsert_and_branch_scope(setup):
    db, user, _ = setup
    first = await api.save_notice(2, api.NoticeInput(branch_id="BR1", status="Pending"), db, user)
    second = await api.save_notice(
        2, api.NoticeInput(branch_id="BR1", status="Completed", notes="Entrance"), db, user
    )
    assert first["id"] == second["id"]
    result = await api.list_notices(2, db, user)
    assert len(result["notices"]) == 1
    assert result["notices"][0]["status"] == "Completed"
    with pytest.raises(HTTPException) as error:
        await api.save_notice(2, api.NoticeInput(branch_id="OTHER", status="Pending"), db, user)
    assert error.value.status_code == 422
    with pytest.raises(HTTPException) as error:
        await api.list_notices(3, db, user)
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_meeting_proofs_duplicates_and_isolation(setup):
    db, user, files = setup
    image = io.BytesIO()
    Image.new("RGB", (10, 10)).save(image, format="PNG")
    result = await api.create_meeting(
        2,
        json.dumps(payload()),
        UploadFile(filename="proof.png", file=io.BytesIO(image.getvalue())),
        db,
        user,
    )
    assert result["has_photo"]
    assert (
        await api.meeting_document(2, result["id"], "photo", db, user)
    ).media_type == "image/jpeg"
    assert len(await api.list_meetings(2, None, 2026, 1, db, user)) == 1
    assert await api.list_meetings(2, None, 2026, 2, db, user) == []
    with pytest.raises(HTTPException) as error:
        await api.create_meeting(
            2,
            json.dumps(payload()),
            UploadFile(filename="proof.png", file=io.BytesIO(image.getvalue())),
            db,
            user,
        )
    assert error.value.status_code == 409
    assert len(files) == 1
    signed = await api.upload_signed(
        2, result["id"], UploadFile(filename="signed.pdf", file=io.BytesIO(pdf_bytes())), db, user
    )
    assert signed["has_signed_mom"]
    with pytest.raises(HTTPException) as error:
        await api.upload_signed(
            2,
            result["id"],
            UploadFile(filename="signed.pdf", file=io.BytesIO(pdf_bytes())),
            db,
            user,
        )
    assert error.value.status_code == 409
    with pytest.raises(HTTPException) as error:
        await api.meeting_document(3, result["id"], "signed", db, user)
    assert error.value.status_code == 403


@pytest.mark.parametrize(
    "changes",
    [
        {"quarter": 2},
        {"year": 2025},
        {"presiding_officer": " "},
        {"meeting_time": "11:00:01"},
        {"attendees": ""},
    ],
)
def test_meeting_validation(changes):
    with pytest.raises(ValidationError):
        api.MeetingInput(**payload(**changes))


def test_photo_validation():
    with pytest.raises(HTTPException):
        api.normalize_photo(b"not an image")


@pytest.mark.asyncio
async def test_detail_update_and_duplicate_protection(setup):
    db, user, _ = setup
    first = await api.create_meeting(2, json.dumps(payload(agenda1="Original")), None, db, user)
    detail = await api.meeting_detail(2, first["id"], db, user)
    assert detail["company_name"] == "Test" and detail["agenda1"] == "Original"
    await api.update_meeting(
        2, first["id"], json.dumps(payload(agenda1="Updated", venue="Virtual")), None, db, user
    )
    detail = await api.meeting_detail(2, first["id"], db, user)
    assert detail["agenda1"] == "Updated" and detail["venue"] == "Virtual"
    await api.create_meeting(
        2, json.dumps(payload(quarter=2, meeting_date="2026-04-18")), None, db, user
    )
    with pytest.raises(HTTPException) as error:
        await api.update_meeting(
            2,
            first["id"],
            json.dumps(payload(quarter=2, meeting_date="2026-04-18")),
            None,
            db,
            user,
        )
    assert error.value.status_code == 409
    for action in (api.meeting_detail,):
        with pytest.raises(HTTPException) as error:
            await action(3, first["id"], db, user)
        assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        await api.update_meeting(3, first["id"], json.dumps(payload()), None, db, user)
    assert error.value.status_code == 403
