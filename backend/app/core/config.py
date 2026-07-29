from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+asyncmy://posh_user:password@mysql:3306/posh_db"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

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

    class Config:
        env_file = ".env"  # reads from the .env file automatically
        case_sensitive = True


# Create a single instance used throughout the app
settings = Settings()
