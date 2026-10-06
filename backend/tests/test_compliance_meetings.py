import io
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.v1 import compliance_meetings as api
from app.db.base import Base
from app.models.company import CompanyMaster
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
