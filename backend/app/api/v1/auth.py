from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from jose import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import UserMaster
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    OTPVerifyRequest,
    ResetPasswordRequest,
    SignupRequest,
)
from app.services.auth_service import AuthService

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService()


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.APP_ENV.lower() == "production",
        samesite="lax",
        path="/api/v1/auth",
    )


@router.post("/signup")
@limiter.limit("5/minute")
async def signup(request: Request, data: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user. Sends OTP to email for verification."""
    return await auth_service.signup(db, data)


@router.post("/verify-otp")
async def verify_otp(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and activate account."""
    return await auth_service.verify_otp(db, data.email, data.otp)


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password. Returns JWT tokens."""
    ip = request.client.host
    result = await auth_service.login(db, data, ip)
    _set_refresh_cookie(response, result["refresh_token"])
    return result


@router.get("/sso/entra/start")
async def entra_sso_start():
    """Return Microsoft Entra login URL when SSO env vars are configured."""
    if not settings.ENTRA_TENANT_ID or not settings.ENTRA_CLIENT_ID:
        raise HTTPException(400, "Microsoft Entra SSO is not configured.")
    params = urlencode(
        {
            "client_id": settings.ENTRA_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": settings.ENTRA_REDIRECT_URI,
            "response_mode": "query",
            "scope": "openid profile email User.Read",
            "state": "posh-entra",
        }
    )
    return {
        "auth_url": (
            f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}"
            f"/oauth2/v2.0/authorize?{params}"
        )
    }


@router.get("/sso/entra/callback")
async def entra_sso_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Complete Entra SSO and issue platform JWTs for an existing active user."""
    if state != "posh-entra":
        raise HTTPException(400, "Invalid Microsoft Entra SSO state.")

    if (
        not settings.ENTRA_TENANT_ID
        or not settings.ENTRA_CLIENT_ID
        or not settings.ENTRA_CLIENT_SECRET
    ):
        raise HTTPException(400, "Microsoft Entra SSO is not configured.")

    token_url = f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}" "/oauth2/v2.0/token"
    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(
            token_url,
            data={
                "client_id": settings.ENTRA_CLIENT_ID,
                "client_secret": settings.ENTRA_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.ENTRA_REDIRECT_URI,
            },
        )
    if token_res.status_code >= 400:
        raise HTTPException(401, "Unable to verify Microsoft Entra login.")

    id_token = token_res.json().get("id_token")
    if not id_token:
        raise HTTPException(401, "Microsoft Entra did not return an ID token.")
    claims = jwt.get_unverified_claims(id_token)
    email = (claims.get("preferred_username") or claims.get("email") or "").lower()
    if not email:
        raise HTTPException(401, "Microsoft Entra account has no email claim.")

    result = await db.execute(select(UserMaster).where(UserMaster.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(403, "No active POSH user is linked to this Entra account.")

    session = await auth_service.issue_session_for_user(
        db, user, request.client.host if request.client else ""
    )
    callback_params = urlencode(
        {
            "access_token": session["access_token"],
            "user_id": session["user_id"],
            "role_id": session["role_id"],
            "company_id": session["company_id"],
        }
    )
    frontend_callback_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/sso/entra/callback#{callback_params}"
    )
    redirect_response = RedirectResponse(frontend_callback_url, status_code=303)
    _set_refresh_cookie(redirect_response, session["refresh_token"])
    return redirect_response


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Revoke refresh token and log out."""
    refresh_token = request.cookies.get("refresh_token", "")
    result = await auth_service.logout(
        db, current_user.user_id, refresh_token, current_user.session_id
    )
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return result


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Get new access token using refresh token."""
    refresh_token = request.cookies.get("refresh_token", "")
    result = await auth_service.refresh_access_token(db, refresh_token)
    _set_refresh_cookie(response, result["refresh_token"])
    return result


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send password reset instructions to email."""
    return await auth_service.forgot_password(db, data.email)


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using token from email."""
    return await auth_service.reset_password(db, data.token, data.new_password)


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Authenticated user changes their own password."""
    return await auth_service.change_password(
        db, current_user.user_id, data.current_password, data.new_password
    )
