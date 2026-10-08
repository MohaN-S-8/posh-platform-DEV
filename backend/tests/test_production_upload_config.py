import importlib
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.core import storage
from app.core.config import Settings

ORIGIN = "https://posh-platform-dev.vercel.app"


@pytest.mark.parametrize(
    "configured",
    [
        f'["{ORIGIN}/"]',
        f"http://localhost:3000, {ORIGIN}/",
        [ORIGIN],
    ],
)
def test_cors_accepts_json_csv_and_list(configured):
    settings = Settings(_env_file=None, BACKEND_CORS_ORIGINS=configured)
    assert ORIGIN in settings.CORS_ORIGINS
    assert len(settings.CORS_ORIGINS) == len(set(settings.CORS_ORIGINS))


def test_frontend_url_is_allowed_without_duplicate_cors_configuration():
    settings = Settings(_env_file=None, FRONTEND_URL=f"{ORIGIN}/")
    assert ORIGIN in settings.CORS_ORIGINS


def test_cors_covers_preflight_validation_and_unhandled_errors():
    api = FastAPI()

    @api.post("/policy-document")
    def upload():
        raise HTTPException(400, "Please upload a PDF policy document.")

    @api.get("/storage-error")
    def storage_error():
        raise RuntimeError("Storage unavailable")

    client = TestClient(
        CORSMiddleware(
            api,
            allow_origins=[ORIGIN],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        ),
        raise_server_exceptions=False,
    )
    preflight = client.options(
        "/policy-document",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    validation = client.post("/policy-document", headers={"Origin": ORIGIN})
    failure = client.get("/storage-error", headers={"Origin": ORIGIN})
    assert [preflight.status_code, validation.status_code, failure.status_code] == [200, 400, 500]
    for response in (preflight, validation, failure):
        assert response.headers["access-control-allow-origin"] == ORIGIN
        assert response.headers["access-control-allow-credentials"] == "true"
    denied = client.options(
        "/policy-document",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in denied.headers


@pytest.mark.parametrize("code", ["403", "AccessDenied", "InvalidAccessKeyId", "500"])
def test_bucket_access_errors_are_not_treated_as_missing_buckets(monkeypatch, code):
    client = Mock()
    client.head_bucket.side_effect = ClientError({"Error": {"Code": code}}, "HeadBucket")
    monkeypatch.setattr(storage, "get_storage_client", lambda: client)
    with pytest.raises(ClientError):
        storage.ensure_bucket_exists("configured-bucket")
    client.create_bucket.assert_not_called()


def test_missing_bucket_is_created(monkeypatch):
    client = Mock()
    client.head_bucket.side_effect = ClientError({"Error": {"Code": "404"}}, "HeadBucket")
    monkeypatch.setattr(storage, "get_storage_client", lambda: client)
    storage.ensure_bucket_exists("configured-bucket")
    client.create_bucket.assert_called_once_with(Bucket="configured-bucket")


def test_storage_clients_use_configured_region(monkeypatch):
    factory = Mock()
    monkeypatch.setattr(storage.boto3, "client", factory)
    monkeypatch.setattr(storage, "_client", None)
    monkeypatch.setattr(storage, "_presign_client", None)
    monkeypatch.setenv("S3_REGION", "auto")
    storage.get_storage_client()
    storage.get_presign_client()
    assert len(factory.call_args_list) == 2
    assert all(call.kwargs["region_name"] == "auto" for call in factory.call_args_list)


def test_policy_bucket_uses_existing_storage_bucket(monkeypatch):
    try:
        monkeypatch.delenv("MINIO_BUCKET_POLICIES", raising=False)
        monkeypatch.setenv("MINIO_BUCKET_CERTIFICATES", "existing-production-bucket")
        importlib.reload(storage)
        assert storage.POLICY_BUCKET == "existing-production-bucket"
        monkeypatch.setenv("MINIO_BUCKET_POLICIES", "dedicated-policy-bucket")
        importlib.reload(storage)
        assert storage.POLICY_BUCKET == "dedicated-policy-bucket"
    finally:
        monkeypatch.undo()
        importlib.reload(storage)
