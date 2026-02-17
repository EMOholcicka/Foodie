from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Validation guardrails (kg)
MIN_WEIGHT_KG = 20.0
MAX_WEIGHT_KG = 500.0


def _normalize_to_utc(dt: datetime) -> datetime:
    """Normalize an input datetime to timezone-aware UTC.

    Rules:
      - If dt is naive, treat it as UTC.
      - If dt is tz-aware, convert to UTC.
    """

    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


class WeightEntryCreate(BaseModel):
    datetime_: datetime = Field(..., alias="datetime", description="Datetime of the weigh-in (naive treated as UTC).")
    weight_kg: float = Field(..., description="Weight in kilograms.")
    note: str | None = Field(default=None, max_length=500)

    @field_validator("datetime_")
    @classmethod
    def validate_datetime(cls, v: datetime) -> datetime:
        return _normalize_to_utc(v)

    @field_validator("weight_kg")
    @classmethod
    def validate_weight(cls, v: float) -> float:
        if not (MIN_WEIGHT_KG <= v <= MAX_WEIGHT_KG):
            raise ValueError(f"weight_kg must be between {MIN_WEIGHT_KG} and {MAX_WEIGHT_KG}")
        return v


class WeightEntryUpdate(BaseModel):
    datetime_: datetime | None = Field(
        default=None,
        alias="datetime",
        description="Updated datetime (naive treated as UTC).",
    )
    weight_kg: float | None = Field(default=None, description="Updated weight in kilograms.")
    note: str | None = Field(default=None, max_length=500)

    @field_validator("datetime_")
    @classmethod
    def validate_datetime(cls, v: datetime | None) -> datetime | None:
        if v is None:
            return None
        return _normalize_to_utc(v)

    @field_validator("weight_kg")
    @classmethod
    def validate_weight(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if not (MIN_WEIGHT_KG <= v <= MAX_WEIGHT_KG):
            raise ValueError(f"weight_kg must be between {MIN_WEIGHT_KG} and {MAX_WEIGHT_KG}")
        return v


class WeightEntryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    datetime_: str = Field(..., alias="datetime", description="Weigh-in datetime normalized to UTC (ISO 8601).")
    weight_kg: float
    note: str | None


class WeightEntryListOut(BaseModel):
    items: list[WeightEntryOut]
