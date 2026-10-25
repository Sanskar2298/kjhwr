"""Application configuration settings module.

This module centralizes all environment variables using Pydantic Settings.
It guarantees strict typing and fallback defaults for development.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core application settings populated from environment variables."""

    # API Server configuration
    API_PORT: int = 8000
    API_HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Elexon BMRS endpoint configuration
    ELEXON_API_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1"

    # Default day-ahead market decision time in Europe/London (HH:MM)
    DEFAULT_DECISION_TIME_HHMM: str = "12:00"
    DEFAULT_TIMEZONE: str = "Europe/London"

    # Data folders
    RAW_DATA_DIR: str = "../data/raw"
    PROCESSED_DATA_DIR: str = "../data/processed"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton instance of application settings.

    Returns:
        Settings: The configured application settings.
    """
    return Settings()
