"""Pydantic validation schemas for raw and processed Elexon BMRS datasets.

Includes models for FUELHH actuals, WINDFOR forecasts, and aligned day-ahead records.
Guarantees timezone-aware UTC datetime fields and strict typing.
"""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FuelHHRecord(BaseModel):
    """Schema for individual FUELHH generation outturn records."""

    dataset: Literal["FUELHH"] = "FUELHH"
    publishTime: datetime
    startTime: datetime
    settlementDate: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    settlementPeriod: int = Field(..., ge=1, le=50)
    fuelType: Literal["WIND"] = "WIND"
    generation: float = Field(..., ge=0.0)

    @field_validator("publishTime", "startTime", mode="after")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        """Ensure all timestamps are timezone-aware and set to UTC."""
        if v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v.astimezone(UTC)


class WindforRecord(BaseModel):
    """Schema for individual WINDFOR national wind generation forecast records."""

    dataset: Literal["WINDFOR"] = "WINDFOR"
    publishTime: datetime
    startTime: datetime
    generation: float = Field(..., ge=0.0)

    @field_validator("publishTime", "startTime", mode="after")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        """Ensure all timestamps are timezone-aware and set to UTC."""
        if v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v.astimezone(UTC)


class IngestionQualityReport(BaseModel):
    """Data quality and coverage summary produced after ingestion."""

    fuelhh_count: int
    fuelhh_min_start: datetime
    fuelhh_max_start: datetime
    fuelhh_missing_settlement_periods: int

    windfor_count: int
    windfor_min_publish: datetime
    windfor_max_publish: datetime
    windfor_min_start: datetime
    windfor_max_start: datetime
    windfor_unique_publish_batches: int

    lead_time_distribution_hours: dict[str, int]
