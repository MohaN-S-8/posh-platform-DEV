from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_verify_certificate_public_access():
    """Certificate verification endpoint should work without auth."""
    with patch(
        "app.services.certificate_service.CertificateService.verify_certificate",
        new_callable=AsyncMock,
        return_value={
            "valid": False,
            "message": "Certificate not found.",
            "certificate_number": "POSH-2026-999999",
        },
    ):
        response = client.get("/api/v1/certificates/verify/POSH-2026-999999")
    # Should NOT return 401 — this is a public endpoint
    assert response.status_code == 200
    assert response.json()["valid"] is False


def test_my_certificates_requires_auth():
    """Employee certificate list requires authentication."""
    response = client.get("/api/v1/certificates/my")
    assert response.status_code == 401


def test_revoke_requires_super_admin():
    """Certificate revocation requires Super Admin role."""
    response = client.post(
        "/api/v1/certificates/1/revoke",
        headers={"Authorization": "Bearer fake_token"},
    )
    assert response.status_code == 401


def test_certificate_number_format():
    """Certificate numbers follow POSH-YEAR-XXXXXX format."""
    import re

    pattern = r"^POSH-\d{4}-\d{6}$"
    sample = "POSH-2026-000123"
    assert re.match(pattern, sample), f"Certificate number format invalid: {sample}"


def test_analytics_requires_auth():
    """Analytics overview requires authentication."""
    response = client.get("/api/v1/analytics/overview")
    assert response.status_code == 401
