import json

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+asyncmy://posh_user:password@mysql:3306/posh_db"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    PRIMARY_SUPER_ADMIN_USER_ID: int = 1

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    FRONTEND_URL: str = "http://localhost:80"
    PUBLIC_APP_URL: str = "http://localhost:80"

    # Microsoft Entra ID / Azure AD SSO
    ENTRA_TENANT_ID: str = ""
    ENTRA_CLIENT_ID: str = ""
    ENTRA_CLIENT_SECRET: str = ""
    ENTRA_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/sso/entra/callback"
    # App
    APP_ENV: str = "development"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def normalize_cors_setting(cls, value):
        return json.dumps(value) if isinstance(value, list) else value

    @property
    def CORS_ORIGINS(self) -> list[str]:
        raw = self.BACKEND_CORS_ORIGINS.strip()
        origins = json.loads(raw) if raw.startswith("[") else raw.split(",")
        origins = [*origins, self.FRONTEND_URL, self.PUBLIC_APP_URL]
        return list(
            dict.fromkeys(
                origin.strip().rstrip("/")
                for origin in origins
                if isinstance(origin, str) and origin.strip()
            )
        )

    class Config:
        env_file = ".env"  # reads from the .env file automatically
        case_sensitive = True
        extra = "ignore"


# Create a single instance used throughout the app
settings = Settings()
