import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_password,
    verify_password,
)
from app.models.auth import AccountLockout, LoginAttempts, OTPVerification, RefreshTokens
from app.models.user import UserMaster
from app.schemas.auth import LoginRequest, SignupRequest

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class AuthService:
    async def signup(self, db: AsyncSession, data: SignupRequest) -> dict:
        # Check duplicate email
        result = await db.execute(select(UserMaster).where(UserMaster.email == data.email.lower()))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists.",
            )

        password_hash = hash_password(data.password)

        user = UserMaster(
            company_id=1,
            employee_id=f"EMP{data.mobile}",
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email.lower(),
            mobile=data.mobile,
            role_id=5,
            username=data.email.lower(),
            password_hash=password_hash,
            status="Inactive",
        )
        db.add(user)
        await db.flush()

        raw_otp, otp_hash = generate_otp()

        otp_record = OTPVerification(
            email=data.email.lower(),
            otp_hash=otp_hash,
            purpose="Signup",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db.add(otp_record)
        await db.commit()

        from app.core.email import send_otp_email

        try:
            await send_otp_email(
                to=data.email.lower(),
                first_name=data.first_name,
                otp=raw_otp,
            )
        except Exception:
            # Don't expose email errors to the client
            pass  # MailHog may not be running in some environments

        return {
            "message": "OTP sent to your email. Please verify to complete registration."
            # raw_otp is NOT returned anymore
        }

    async def verify_otp(self, db: AsyncSession, email: str, otp: str) -> dict:
        otp_hash = hashlib.sha256(otp.encode()).hexdigest()

        result = await db.execute(
            select(OTPVerification).where(
                OTPVerification.email == email.lower(),
                OTPVerification.otp_hash == otp_hash,
                OTPVerification.purpose == "Signup",
                OTPVerification.verified == False,  # noqa: E712
                OTPVerification.expires_at > datetime.now(timezone.utc),
            )
        )
        otp_record = result.scalar_one_or_none()

        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP.",
            )

        otp_record.verified = True
        await db.execute(
            update(UserMaster).where(UserMaster.email == email.lower()).values(status="Active")
        )
        await db.commit()
        return {"message": "Registration completed successfully."}

    async def login(self, db: AsyncSession, data: LoginRequest, ip_address: str) -> dict:
        result = await db.execute(select(UserMaster).where(UserMaster.email == data.email.lower()))
        user = result.scalar_one_or_none()

        if not user:
            await self._log_attempt(db, None, data.email, ip_address, False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        lockout_result = await db.execute(
            select(AccountLockout).where(AccountLockout.user_id == user.user_id)
        )
        lockout = lockout_result.scalar_one_or_none()

        if lockout and lockout.locked_until and lockout.locked_until > datetime.now(timezone.utc):
            minutes_left = (
                int((lockout.locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            )
            await self._log_attempt(db, user.user_id, data.email, ip_address, False)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account locked. Try again in {minutes_left} minutes.",
            )

        if not verify_password(data.password, user.password_hash):
            await self._log_attempt(db, user.user_id, data.email, ip_address, False)
            await self._increment_lockout(db, user.user_id, lockout)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if user.status != "Active":
            await self._log_attempt(db, user.user_id, data.email, ip_address, False)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is inactive. Contact your administrator.",
            )

        if lockout:
            lockout.failed_attempts = 0
            lockout.locked_until = None

        access_token = create_access_token(
            {
                "user_id": user.user_id,
                "company_id": user.company_id,
                "role_id": user.role_id,
            }
        )
        raw_refresh, hashed_refresh = create_refresh_token()

        refresh_record = RefreshTokens(
            user_id=user.user_id,
            token_hash=hashed_refresh,
            ip_address=ip_address,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(refresh_record)
        await self._log_attempt(db, user.user_id, data.email, ip_address, True)
        await db.commit()

        return {
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "user_id": user.user_id,
            "role_id": user.role_id,
            "company_id": user.company_id,
        }

    async def _log_attempt(self, db, user_id, email, ip, success):
        attempt = LoginAttempts(
            user_id=user_id,
            email_attempted=email,
            ip_address=ip,
            success=success,
        )
        db.add(attempt)

    async def issue_session_for_user(
        self, db: AsyncSession, user: UserMaster, ip_address: str
    ) -> dict:
        if user.status != "Active" or user.is_deleted != "N":
            await self._log_attempt(db, user.user_id, user.email, ip_address, False)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is inactive. Contact your administrator.",
            )

        access_token = create_access_token(
            {
                "user_id": user.user_id,
                "company_id": user.company_id,
                "role_id": user.role_id,
            }
        )
        raw_refresh, hashed_refresh = create_refresh_token()
        db.add(
            RefreshTokens(
                user_id=user.user_id,
                token_hash=hashed_refresh,
                ip_address=ip_address,
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
        )
        await self._log_attempt(db, user.user_id, user.email, ip_address, True)
        await db.commit()
        return {
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "user_id": user.user_id,
            "role_id": user.role_id,
            "company_id": user.company_id,
        }

    async def _increment_lockout(self, db, user_id, lockout):
        if not lockout:
            lockout = AccountLockout(user_id=user_id, failed_attempts=0)
            db.add(lockout)

        lockout.failed_attempts = (lockout.failed_attempts or 0) + 1

        if lockout.failed_attempts >= MAX_FAILED_ATTEMPTS:
            lockout.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)

    async def logout(self, db: AsyncSession, user_id: int, refresh_token: str) -> dict:
        """Revoke the refresh token. Access token expires naturally after 15 min."""
        import hashlib

        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

        result = await db.execute(
            select(RefreshTokens).where(
                RefreshTokens.user_id == user_id,
                RefreshTokens.token_hash == token_hash,
                RefreshTokens.revoked == False,  # noqa: E712
            )
        )
        token_record = result.scalar_one_or_none()

        if token_record:
            token_record.revoked = True
            await db.commit()

        return {"message": "Logged out successfully."}

    async def refresh_access_token(self, db: AsyncSession, refresh_token: str) -> dict:
        """Exchange a valid refresh token for a new access token."""
        import hashlib
        from datetime import datetime, timezone

        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

        result = await db.execute(
            select(RefreshTokens).where(
                RefreshTokens.token_hash == token_hash,
                RefreshTokens.revoked == False,  # noqa: E712
                RefreshTokens.expires_at > datetime.now(timezone.utc),
            )
        )
        token_record = result.scalar_one_or_none()

        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token.",
            )

        # Rotate the refresh token (old one revoked, new one issued)
        token_record.revoked = True

        raw_refresh, hashed_refresh = create_refresh_token()
        new_record = RefreshTokens(
            user_id=token_record.user_id,
            token_hash=hashed_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(new_record)

        # Fetch user for new access token
        user_result = await db.execute(
            select(UserMaster).where(UserMaster.user_id == token_record.user_id)
        )
        user = user_result.scalar_one()

        access_token = create_access_token(
            {
                "user_id": user.user_id,
                "company_id": user.company_id,
                "role_id": user.role_id,
            }
        )
        await db.commit()

        return {
            "access_token": access_token,
            "refresh_token": raw_refresh,
        }

    async def forgot_password(self, db: AsyncSession, email: str) -> dict:
        """Send password reset link to email."""
        from app.models.auth import PasswordResetTokens

        result = await db.execute(select(UserMaster).where(UserMaster.email == email.lower()))
        user = result.scalar_one_or_none()

        # Always return same message â€” don't reveal if email exists (security)
        if not user:
            return {"message": "If this email is registered, you will receive reset instructions."}

        # Generate reset token
        raw_token, token_hash = create_refresh_token()  # reuse same logic

        reset_record = PasswordResetTokens(
            user_id=user.user_id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(reset_record)
        await db.commit()

        from app.core.email import send_password_reset_email

        try:
            await send_password_reset_email(
                to=user.email,
                first_name=user.first_name,
                reset_token=raw_token,
            )
        except Exception:
            pass

        return {"message": "If this email is registered, you will receive reset instructions."}

    async def reset_password(self, db: AsyncSession, token: str, new_password: str) -> dict:
        """Reset password using the token from email."""
        import hashlib

        from app.models.auth import PasswordResetTokens

        token_hash = hashlib.sha256(token.encode()).hexdigest()

        result = await db.execute(
            select(PasswordResetTokens).where(
                PasswordResetTokens.token_hash == token_hash,
                PasswordResetTokens.used == False,  # noqa: E712
                PasswordResetTokens.expires_at > datetime.now(timezone.utc),
            )
        )
        reset_record = result.scalar_one_or_none()

        if not reset_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token.",
            )

        # Update password
        new_hash = hash_password(new_password)
        await db.execute(
            update(UserMaster)
            .where(UserMaster.user_id == reset_record.user_id)
            .values(password_hash=new_hash)
        )

        # Mark token as used
        reset_record.used = True
        await db.commit()

        return {"message": "Password reset successfully. You can now log in."}

    async def change_password(
        self, db: AsyncSession, user_id: int, current_password: str, new_password: str
    ) -> dict:
        result = await db.execute(select(UserMaster).where(UserMaster.user_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        user.password_hash = hash_password(new_password)
        await db.commit()
        return {"message": "Password changed successfully."}
