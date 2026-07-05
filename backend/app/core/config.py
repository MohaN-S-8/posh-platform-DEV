from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "mysql+asyncmy://posh_user:password@mysql:3306/posh_db"

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("mysql://"):
            return value.replace("mysql://", "mysql+asyncmy://", 1)
        return value

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Object storage
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_PUBLIC_ENDPOINT: str = "http://localhost:9000"
    MINIO_ROOT_USER: str = "minioadmin"
    MINIO_ROOT_PASSWORD: str = "minioadmin123"
    S3_REGION: str = "us-east-1"
    MINIO_BUCKET_VIDEOS: str = "posh-videos"
    MINIO_BUCKET_CERTIFICATES: str = "posh-certificates"

    # Email
    SMTP_HOST: str = "mailhog"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM: str = "noreply@posh-platform.com"

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    FRONTEND_URL: str = "http://localhost:80"
    PUBLIC_APP_URL: str = "http://localhost:80"

    # Microsoft Entra ID / Azure AD SSO
    ENTRA_TENANT_ID: str = ""
    ENTRA_CLIENT_ID: str = ""
    ENTRA_CLIENT_SECRET: str = ""
    ENTRA_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/sso/entra/callback"
    # App
    APP_ENV: str = "development"


# Create a single instance used throughout the app
settings = Settings()
