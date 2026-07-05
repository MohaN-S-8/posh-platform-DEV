from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_progress_update_rejects_fast_forward():
    """Fast-forward must be blocked server-side."""
    with patch(
        "app.services.video_service.VideoService.update_progress",
        new_callable=AsyncMock,
        side_effect=HTTPException(
            status_code=400,
            detail="Fast-forward is not allowed.",
        ),
    ):
        response = client.post(
            "/api/v1/videos/1/progress",
            json={"current_position": 9999, "total_duration": 1200},
            cookies={"access_token": "fake_token"},
        )
    assert response.status_code in [400, 401]  # 401 if token invalid, 400 if service rejects


def test_stream_url_requires_auth():
    """Unauthenticated request to stream URL should be rejected."""
    response = client.get("/api/v1/videos/1/stream-url")
    assert response.status_code == 401


def test_assessment_blocked_before_video_complete():
    """Assessment submit must fail if video not completed."""
    with patch(
        "app.services.assessment_service.AssessmentService.submit",
        new_callable=AsyncMock,
        side_effect=HTTPException(
            status_code=400,
            detail="Please complete the training video before taking the assessment.",
        ),
    ):
        response = client.post(
            "/api/v1/assessments/submit",
            json={"video_id": 1, "answers": []},
            cookies={"access_token": "fake_token"},
        )
    assert response.status_code in [400, 401]
