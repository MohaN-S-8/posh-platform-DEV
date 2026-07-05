from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ── Signup Validation Tests ────────────────────────────────────────────────────


def test_signup_empty_first_name():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "",
            "last_name": "Kumar",
            "email": "test@example.com",
            "password": "Test@1234",
            "confirm_password": "Test@1234",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_numbers_in_first_name():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi123",
            "last_name": "Kumar",
            "email": "test@example.com",
            "password": "Test@1234",
            "confirm_password": "Test@1234",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_invalid_email_format():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "email": "not-an-email",
            "password": "Test@1234",
            "confirm_password": "Test@1234",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_email_too_long():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "email": "averylongemail123456@example.com",  # > 25 chars
            "password": "Test@1234",
            "confirm_password": "Test@1234",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_password_too_short():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "email": "ravi@test.com",
            "password": "Ab@1",
            "confirm_password": "Ab@1",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_password_no_uppercase():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "email": "ravi@test.com",
            "password": "test@1234",
            "confirm_password": "test@1234",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_password_no_special_char():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "email": "ravi@test.com",
            "password": "Test12345",
            "confirm_password": "Test12345",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_passwords_do_not_match():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "email": "ravi@test.com",
            "password": "Test@1234",
            "confirm_password": "Test@5678",
            "mobile": "9876543210",
        },
    )
    assert response.status_code == 422


def test_signup_invalid_mobile():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "email": "ravi@test.com",
            "password": "Test@1234",
            "confirm_password": "Test@1234",
            "mobile": "123",
        },
    )
    assert response.status_code == 422


# ── Login Validation Tests ─────────────────────────────────────────────────────


def test_login_empty_email():
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "",
            "password": "Test@1234",
        },
    )
    assert response.status_code == 422


def test_login_invalid_credentials():
    """
    Mock only the service layer — no DB, no Docker needed.
    FastAPI's request flow runs normally; only the business logic is stubbed.
    """
    with patch(
        "app.services.auth_service.AuthService.login",
        new_callable=AsyncMock,
        side_effect=HTTPException(status_code=401, detail="Invalid email or password."),
    ):
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nobody@nowhere.com",
                "password": "WrongPass@1",
            },
        )

    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]
