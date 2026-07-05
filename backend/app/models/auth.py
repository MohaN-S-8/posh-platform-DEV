from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.base import Base


class OTPVerification(Base):
    __tablename__ = "otp_verification"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(100))
    otp_hash = Column(String(255))
    purpose = Column(Enum("Signup", "PasswordReset"))
    expires_at = Column(DateTime)
    verified = Column(Boolean, default=False)
    created_date = Column(DateTime, server_default=func.now())


class AccountLockout(Base):
    __tablename__ = "account_lockout"

    user_id = Column(BigInteger, ForeignKey("user_master.user_id"), primary_key=True)
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)


class LoginAttempts(Base):
    __tablename__ = "login_attempts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=True)
    email_attempted = Column(String(100))
    ip_address = Column(String(45))
    success = Column(Boolean)
    attempted_at = Column(DateTime, server_default=func.now())


class RefreshTokens(Base):
    __tablename__ = "refresh_tokens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    token_hash = Column(String(255))
    device_info = Column(String(255))
    ip_address = Column(String(45))
    expires_at = Column(DateTime)
    revoked = Column(Boolean, default=False)
    created_date = Column(DateTime, server_default=func.now())


class PasswordResetTokens(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user_master.user_id"))
    token_hash = Column(String(255))
    expires_at = Column(DateTime)
    used = Column(Boolean, default=False)
    created_date = Column(DateTime, server_default=func.now())
