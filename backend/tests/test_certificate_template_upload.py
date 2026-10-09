import importlib
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.services import certificate_service


def test_certificate_bucket_uses_production_configuration(monkeypatch):
    try:
        monkeypatch.setenv("MINIO_BUCKET_CERTIFICATES", "production-certificates")
        importlib.reload(certificate_service)
        assert certificate_service.CERT_BUCKET == "production-certificates"
        monkeypatch.delenv("MINIO_BUCKET_CERTIFICATES", raising=False)
        importlib.reload(certificate_service)
        assert certificate_service.CERT_BUCKET == "posh-certificates"
    finally:
        monkeypatch.undo()
        importlib.reload(certificate_service)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "asset_type,field",
    [
        ("template", "template_file_path"),
        ("logo", "logo_path"),
        ("signature", "signature_path"),
    ],
)
async def test_asset_upload_uses_configured_bucket_and_saves_path(monkeypatch, asset_type, field):
    service = certificate_service.CertificateService()
    template = SimpleNamespace(company_id=2, status="Active")
    service._get_template = AsyncMock(return_value=template)
    db = AsyncMock()
    upload = Mock()
    monkeypatch.setattr(certificate_service, "CERT_BUCKET", "production-certificates")
    monkeypatch.setattr(certificate_service, "upload_file", upload)
    file = UploadFile(
        io.BytesIO(b"asset-bytes"),
        filename="asset.png",
        headers=Headers({"content-type": "image/png"}),
    )
    result = await service.upload_template_asset(
        db, 1, 2, file, asset_type, require_reapproval=True
    )
    key = f"certificate-templates/2/1/{asset_type}.png"
    upload.assert_called_once_with(b"asset-bytes", "production-certificates", key, "image/png")
    assert getattr(result, field) == key
    assert result.status == "Pending"
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(template)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error",
    [
        ClientError({"Error": {"Code": "AccessDenied"}}, "PutObject"),
        EndpointConnectionError(endpoint_url="https://storage.example"),
    ],
)
async def test_storage_failure_does_not_save_a_broken_template_path(monkeypatch, error):
    service = certificate_service.CertificateService()
    template = SimpleNamespace(company_id=2, template_file_path="previous.pdf", status="Active")
    service._get_template = AsyncMock(return_value=template)
    db = AsyncMock()
    monkeypatch.setattr(certificate_service, "upload_file", Mock(side_effect=error))
    file = UploadFile(io.BytesIO(b"asset-bytes"), filename="template.pdf")
    with pytest.raises(HTTPException) as raised:
        await service.upload_template_asset(db, 1, 2, file, "template", require_reapproval=True)
    assert raised.value.status_code == 503
    assert "MINIO_BUCKET_CERTIFICATES" in raised.value.detail
    assert template.template_file_path == "previous.pdf"
    assert template.status == "Active"
    db.commit.assert_not_awaited()
