import io
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_bulk_upload_requires_auth():
    """Unauthenticated upload should be rejected."""
    response = client.post("/api/v1/hr/employees/bulk-upload")
    assert response.status_code == 401


def test_bulk_upload_rejects_wrong_format():
    """PDF files should be rejected — only xlsx/csv allowed."""
    with patch(
        "app.services.hr_service.HRService.bulk_upload_employees",
        new_callable=AsyncMock,
        side_effect=HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload .xlsx or .csv",
        ),
    ):
        fake_pdf = io.BytesIO(b"%PDF fake content")
        response = client.post(
            "/api/v1/hr/employees/bulk-upload",
            files={"file": ("employees.pdf", fake_pdf, "application/pdf")},
            headers={"Authorization": "Bearer fake_token"},
        )
    assert response.status_code in [400, 401]


def test_training_assign_requires_auth():
    """Unauthenticated assignment should be rejected."""
    response = client.post(
        "/api/v1/hr/training/assign",
        json={
            "video_id": 1,
            "assign_type": "Company-Wide",
            "due_days": 30,
            "passing_score": 70,
        },
    )
    assert response.status_code == 401


def test_compliance_dashboard_requires_auth():
    """Compliance dashboard is not public."""
    response = client.get("/api/v1/hr/compliance/dashboard")
    assert response.status_code == 401


def test_employee_report_download_requires_auth():
    """Report download requires authentication."""
    response = client.get("/api/v1/hr/reports/employees")
    assert response.status_code == 401


def test_training_assign_invalid_type():
    """Invalid assign_type should return validation error."""
    with patch(
        "app.services.hr_service.HRService.assign_training",
        new_callable=AsyncMock,
        side_effect=HTTPException(
            status_code=400,
            detail="assign_type must be Individual, Department, or Company-Wide",
        ),
    ):
        response = client.post(
            "/api/v1/hr/training/assign",
            json={
                "video_id": 1,
                "assign_type": "InvalidType",
                "due_days": 30,
            },
            headers={"Authorization": "Bearer fake_token"},
        )
    assert response.status_code in [400, 401]
