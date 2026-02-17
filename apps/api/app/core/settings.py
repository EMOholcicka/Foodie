from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=None,  # compose/.env handled outside the app
        case_sensitive=False,
        extra="ignore",
    )

    # Core runtime
    env: str = Field(default="dev", validation_alias="ENV")
    tz: str = Field(default="UTC", validation_alias="TZ")

    # Auth / JWT
    # IMPORTANT:
    #   - we keep defaults for dev/test convenience
    #   - we fail fast in non-dev envs if secrets are missing/weak
    _DEV_ACCESS_SECRET_DEFAULT = "dev-access-secret-change-me"
    _DEV_REFRESH_SECRET_DEFAULT = "dev-refresh-secret-change-me"

    jwt_access_secret: str = Field(
        default=_DEV_ACCESS_SECRET_DEFAULT,
        validation_alias="JWT_ACCESS_SECRET",
    )
    jwt_refresh_secret: str = Field(
        default=_DEV_REFRESH_SECRET_DEFAULT,
        validation_alias="JWT_REFRESH_SECRET",
    )
    jwt_access_expires_seconds: int = Field(
        default=15 * 60,
        validation_alias="JWT_ACCESS_EXPIRES_SECONDS",
    )
    jwt_refresh_expires_seconds: int = Field(
        default=30 * 24 * 60 * 60,
        validation_alias="JWT_REFRESH_EXPIRES_SECONDS",
    )

    # JWT claim hardening
    jwt_issuer: str = Field(default="foodie-api", validation_alias="JWT_ISSUER")
    jwt_audience: str = Field(default="foodie", validation_alias="JWT_AUDIENCE")

    # Logging
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    # HTTP
    cors_origins: str = Field(default="", validation_alias="CORS_ORIGINS")

    # Database
    # Required: no default, to avoid accidentally running against localhost in containers.
    database_url: str = Field(validation_alias="DATABASE_URL")

    def cors_origins_list(self) -> list[str]:
        value = self.cors_origins
        if not value:
            return []

        origins = [v.strip() for v in value.split(",") if v.strip()]

        # Fail fast for the common (but invalid with credentials) star config.
        if origins == ["*"]:
            raise ValueError(
                "Invalid CORS_ORIGINS: cannot be '*' when allow_credentials is enabled. "
                "Set explicit origins (comma-separated), e.g. http://localhost:5173"
            )

        return origins

    def validate_security(self) -> None:
        """Fail fast on insecure auth configuration in non-dev environments."""

        if self.env.lower() == "dev":
            return

        errors: list[str] = []

        if not self.jwt_access_secret or self.jwt_access_secret == self._DEV_ACCESS_SECRET_DEFAULT:
            errors.append("JWT_ACCESS_SECRET must be set to a strong value")

        if not self.jwt_refresh_secret or self.jwt_refresh_secret == self._DEV_REFRESH_SECRET_DEFAULT:
            errors.append("JWT_REFRESH_SECRET must be set to a strong value")

        if self.jwt_access_secret and len(self.jwt_access_secret) < 32:
            errors.append("JWT_ACCESS_SECRET must be at least 32 characters")

        if self.jwt_refresh_secret and len(self.jwt_refresh_secret) < 32:
            errors.append("JWT_REFRESH_SECRET must be at least 32 characters")

        if self.jwt_access_secret == self.jwt_refresh_secret:
            errors.append("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different")

        if errors:
            raise RuntimeError("Insecure JWT configuration: " + "; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_security()
    return settings
