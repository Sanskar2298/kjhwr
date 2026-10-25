"""Pydantic request and response schemas for FastAPI endpoints.

Strict typing, documentation, and serialization for forecasts, actuals, and accuracy metrics.
"""

from datetime import date as dt_date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str = Field("healthy", description="Service health state")
    environment: str = Field("development", description="Current execution environment")
    version: str = Field("0.1.0", description="API version")


class MetaResponse(BaseModel):
    """System metadata and available data range response schema."""

    min_delivery_date: dt_date = Field(
        ..., description="Earliest available delivery date"
    )
    max_delivery_date: dt_date = Field(
        ..., description="Latest available delivery date"
    )
    default_delivery_date: dt_date = Field(
        ..., description="Default delivery date for dashboard"
    )
    default_cutoff_hour: str = Field(
        "09:00", description="Default decision cutoff time (HH:MM)"
    )
    timezone: str = Field("Europe/London", description="Trading desk timezone")
    total_periods_available: int = Field(
        ..., description="Total actual settlement periods available"
    )


class DecisionForecastPoint(BaseModel):
    """Single half-hourly forecast point available at decision time."""

    target_start: datetime = Field(
        ..., description="Start of delivery settlement period (UTC)"
    )
    settlement_period: int = Field(
        ..., ge=1, le=50, description="Settlement period (1-48, or 50 on clock change)"
    )
    forecast_mw: float | None = Field(None, description="Forecast power output in MW")
    publish_time: datetime | None = Field(
        None, description="Timestamp forecast was published (UTC)"
    )
    horizon_hours: float | None = Field(
        None, description="Lead time between publication and delivery (hours)"
    )
    band_p10_mw: float | None = Field(
        None, description="Empirical 10th percentile lower uncertainty bound"
    )
    band_p50_mw: float | None = Field(
        None, description="Empirical 50th percentile median uncertainty bound"
    )
    band_p90_mw: float | None = Field(
        None, description="Empirical 90th percentile upper uncertainty bound"
    )


class DecisionForecastResponse(BaseModel):
    """Response containing decision forecast series and uncertainty bands."""

    delivery_date: dt_date = Field(..., description="Delivery date evaluated")
    cutoff_hour: str = Field(..., description="Decision cutoff time in Europe/London")
    cutoff_utc: datetime = Field(..., description="Cutoff translated to UTC")
    points: list[DecisionForecastPoint] = Field(
        ..., description="Time series of half-hourly forecast points"
    )


class ForecastEvolutionPoint(BaseModel):
    """Historical revision for a specific target delivery start time."""

    publish_time: datetime = Field(..., description="Publication time (UTC)")
    start_time: datetime = Field(..., description="Target delivery start time (UTC)")
    generation_mw: float = Field(..., description="Forecast generation in MW")
    horizon_hours: float = Field(..., description="Lead time in hours ahead of target")


class ForecastEvolutionResponse(BaseModel):
    """Sequential revisions of forecast for a specific delivery period."""

    target_start: datetime = Field(..., description="Target delivery start time (UTC)")
    revisions: list[ForecastEvolutionPoint] = Field(
        ..., description="Sequential revisions ordered by publish time"
    )


class ActualPoint(BaseModel):
    """Half-hourly outturn generation point from FUELHH."""

    start_time: datetime = Field(..., description="Start of settlement period (UTC)")
    settlement_date: str = Field(..., description="Settlement date (YYYY-MM-DD)")
    settlement_period: int = Field(..., description="Settlement period (1-48)")
    fuel_type: str = Field("WIND", description="Fuel type category")
    actual_mw: float = Field(..., description="Outturn generation in MW")


class ActualsResponse(BaseModel):
    """Outturn actuals response."""

    count: int = Field(..., description="Number of settlement periods returned")
    actuals: list[ActualPoint] = Field(
        ..., description="List of actual generation points"
    )


class AccuracyMetricsSummary(BaseModel):
    """Quantitative forecast accuracy metrics summary."""

    start_date: dt_date = Field(..., description="Evaluation start date")
    end_date: dt_date = Field(..., description="Evaluation end date")
    cutoff_hour: str = Field(..., description="Decision cutoff time evaluated")
    n_intervals: int = Field(..., description="Evaluated half-hour periods")
    n_zero_actuals_suppressed: int = Field(
        ..., description="Periods suppressed from MAPE due to zero actuals"
    )
    mae_mw: float = Field(..., description="Mean Absolute Error in MW")
    rmse_mw: float = Field(..., description="Root Mean Square Error in MW")
    mean_bias_mw: float = Field(..., description="Mean Bias (Forecast - Actual) in MW")
    median_ae_mw: float = Field(..., description="Median Absolute Error in MW")
    p90_ae_mw: float = Field(..., description="90th percentile Absolute Error in MW")
    p95_ae_mw: float = Field(..., description="95th percentile Absolute Error in MW")
    nmae_pct: float = Field(..., description="Normalized MAE vs mean actual (%)")
    mape_pct: float | None = Field(
        None, description="Mean Absolute Percentage Error (%)"
    )
    r2: float = Field(..., description="Coefficient of determination R²")


class HorizonBucketBreakdown(BaseModel):
    """Accuracy metrics grouped by lead horizon bucket."""

    horizon_bucket: str = Field(..., description="Horizon bucket label (e.g. 16-20h)")
    count: int = Field(..., description="Number of intervals in bucket")
    mae_mw: float = Field(..., description="MAE in MW")
    rmse_mw: float = Field(..., description="RMSE in MW")
    mean_bias_mw: float = Field(..., description="Mean Bias in MW")


class HourOfDayBreakdown(BaseModel):
    """Accuracy metrics grouped by clock hour of day."""

    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23 UTC)")
    count: int = Field(..., description="Interval count")
    mae_mw: float = Field(..., description="MAE in MW")
    rmse_mw: float = Field(..., description="RMSE in MW")
    mean_bias_mw: float = Field(..., description="Mean Bias in MW")
    mean_actual_mw: float = Field(..., description="Mean actual MW")
    mean_forecast_mw: float = Field(..., description="Mean forecast MW")


class WindLevelBreakdown(BaseModel):
    """Accuracy metrics grouped by wind generation regime."""

    wind_level: str = Field(..., description="Wind level regime (<5GW, 5-12GW, >12GW)")
    count: int = Field(..., description="Interval count")
    mae_mw: float = Field(..., description="MAE in MW")
    rmse_mw: float = Field(..., description="RMSE in MW")
    mean_bias_mw: float = Field(..., description="Mean Bias in MW")
    nmae_pct: float = Field(..., description="Normalized MAE (%)")


class DailyBreakdown(BaseModel):
    """Accuracy metrics grouped by delivery day."""

    model_config = ConfigDict(populate_by_name=True)

    delivery_date: dt_date = Field(
        ..., serialization_alias="date", description="Delivery date"
    )
    count: int = Field(..., description="Interval count")
    mae_mw: float = Field(..., description="Daily MAE in MW")
    rmse_mw: float = Field(..., description="Daily RMSE in MW")
    mean_bias_mw: float = Field(..., description="Daily Mean Bias in MW")
    mean_actual_mw: float = Field(..., description="Daily Mean Actual MW")
    mean_forecast_mw: float = Field(..., description="Daily Mean Forecast MW")


class TimeseriesComparisonPoint(BaseModel):
    """Paired actual outturn and decision forecast comparison point."""

    target_start: datetime = Field(
        ..., description="Settlement period start time (UTC)"
    )
    settlement_period: int = Field(..., description="Settlement period (1-48)")
    actual_mw: float | None = Field(None, description="Actual generation in MW")
    forecast_mw: float | None = Field(None, description="Decision forecast in MW")
    error_mw: float | None = Field(None, description="Error (Forecast - Actual) in MW")
    abs_error_mw: float | None = Field(None, description="Absolute error in MW")
    horizon_hours: float | None = Field(
        None, description="Forecast lead horizon in hours"
    )
