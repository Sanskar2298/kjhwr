"""API routers for forecast decisions, evolution, actuals, and accuracy evaluation."""

import logging
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.api import (
    AccuracyMetricsSummary,
    ActualPoint,
    ActualsResponse,
    DailyBreakdown,
    DecisionForecastPoint,
    DecisionForecastResponse,
    ForecastEvolutionPoint,
    ForecastEvolutionResponse,
    HorizonBucketBreakdown,
    HourOfDayBreakdown,
    MetaResponse,
    TimeseriesComparisonPoint,
    WindLevelBreakdown,
)
from app.services.analysis import compute_error_breakdowns, compute_metrics
from app.services.data_manager import DataManager, get_data_manager

logger = logging.getLogger("api_routers")
router = APIRouter(prefix="/api", tags=["Day-Ahead Trading Support"])


@router.get(
    "/meta", response_model=MetaResponse, summary="Get system metadata and data range"
)
async def get_metadata(dm: DataManager = Depends(get_data_manager)) -> MetaResponse:
    """Return available delivery date bounds, defaults, and timezone."""
    meta = dm.get_meta()
    return MetaResponse(**meta)


@router.get(
    "/forecast/decision",
    response_model=DecisionForecastResponse,
    summary="Get day-ahead decision forecast and empirical uncertainty bands",
)
async def get_decision_forecast_endpoint(
    delivery_date: date = Query(..., description="Target delivery date (YYYY-MM-DD)"),
    cutoff_hour: str = Query(
        "09:00",
        pattern=r"^\d{2}:\d{2}$",
        description="Decision cutoff time in Europe/London (HH:MM)",
    ),
    dm: DataManager = Depends(get_data_manager),
) -> DecisionForecastResponse:
    """Return the latest forecast available at decision time on D-1 along with P10/P50/P90 error bands."""
    df, cutoff_utc = dm.get_decision_forecast_with_bands(delivery_date, cutoff_hour)
    points = []
    for _, row in df.iterrows():
        points.append(
            DecisionForecastPoint(
                target_start=row["target_start"],
                settlement_period=int(row["settlementPeriod"]),
                forecast_mw=(
                    row["forecast_mw"] if not pd_isna(row["forecast_mw"]) else None
                ),
                publish_time=(
                    row["publishTime"] if not pd_isna(row["publishTime"]) else None
                ),
                horizon_hours=(
                    row["horizon_hours"] if not pd_isna(row["horizon_hours"]) else None
                ),
                band_p10_mw=(
                    row["band_p10_mw"] if not pd_isna(row["band_p10_mw"]) else None
                ),
                band_p50_mw=(
                    row["band_p50_mw"] if not pd_isna(row["band_p50_mw"]) else None
                ),
                band_p90_mw=(
                    row["band_p90_mw"] if not pd_isna(row["band_p90_mw"]) else None
                ),
            )
        )

    return DecisionForecastResponse(
        delivery_date=delivery_date,
        cutoff_hour=cutoff_hour,
        cutoff_utc=cutoff_utc,
        points=points,
    )


@router.get(
    "/forecast/evolution",
    response_model=ForecastEvolutionResponse,
    summary="Get historical forecast revisions for a specific target hour",
)
async def get_forecast_evolution_endpoint(
    target: datetime = Query(
        ..., description="Target delivery start time in UTC (ISO-8601)"
    ),
    dm: DataManager = Depends(get_data_manager),
) -> ForecastEvolutionResponse:
    """Trace all sequential forecasts published for a target delivery period."""
    evo_df = dm.get_evolution(target)
    revisions = []
    for _, row in evo_df.iterrows():
        revisions.append(
            ForecastEvolutionPoint(
                publish_time=row["publishTime"],
                start_time=row["startTime"],
                generation_mw=float(row["generation"]),
                horizon_hours=float(row["horizon_hours"]),
            )
        )
    return ForecastEvolutionResponse(target_start=target, revisions=revisions)


@router.get(
    "/actuals", response_model=ActualsResponse, summary="Get outturn generation actuals"
)
async def get_actuals_endpoint(
    start: date = Query(..., description="Start settlement date (YYYY-MM-DD)"),
    end: date = Query(..., description="End settlement date (YYYY-MM-DD)"),
    dm: DataManager = Depends(get_data_manager),
) -> ActualsResponse:
    """Retrieve half-hourly outturn generation records from FUELHH (fuelType=WIND)."""
    if start > end:
        raise HTTPException(
            status_code=400, detail="start date must be before or equal to end date"
        )

    df = dm.get_actuals(start, end)
    actuals = []
    for _, row in df.iterrows():
        actuals.append(
            ActualPoint(
                start_time=row["startTime"],
                settlement_date=row["settlementDate"],
                settlement_period=int(row["settlementPeriod"]),
                fuel_type=row["fuelType"],
                actual_mw=float(row["generation"]),
            )
        )
    return ActualsResponse(count=len(actuals), actuals=actuals)


@router.get(
    "/accuracy/summary",
    response_model=AccuracyMetricsSummary,
    summary="Get quantitative accuracy KPIs",
)
async def get_accuracy_summary(
    start: date = Query(date(2026, 1, 1), description="Start delivery date"),
    end: date = Query(date(2026, 1, 31), description="End delivery date"),
    cutoff_hour: str = Query("09:00", description="Decision cutoff time"),
    dm: DataManager = Depends(get_data_manager),
) -> AccuracyMetricsSummary:
    """Compute overall MAE, RMSE, Mean Bias, NMAE, MAPE, P90, and R2."""
    if start > end:
        raise HTTPException(
            status_code=400, detail="start date must be before or equal to end date"
        )

    aligned_df = dm.get_aligned_timeseries(start, end, cutoff_hour)
    metrics = compute_metrics(aligned_df["actual_mw"], aligned_df["forecast_mw"])

    return AccuracyMetricsSummary(
        start_date=start,
        end_date=end,
        cutoff_hour=cutoff_hour,
        n_intervals=metrics["n_intervals"],
        n_zero_actuals_suppressed=metrics["n_zero_actuals_suppressed_in_mape"],
        mae_mw=metrics["mae"],
        rmse_mw=metrics["rmse"],
        mean_bias_mw=metrics["mean_bias"],
        median_ae_mw=metrics["median_ae"],
        p90_ae_mw=metrics["p90_ae"],
        p95_ae_mw=metrics["p95_ae"],
        nmae_pct=metrics["nmae_pct"],
        mape_pct=metrics["mape_pct"],
        r2=metrics["r2"],
    )


@router.get(
    "/accuracy/by-horizon",
    response_model=list[HorizonBucketBreakdown],
    summary="Error breakdown by horizon",
)
async def get_accuracy_by_horizon(
    start: date = Query(date(2026, 1, 1), description="Start delivery date"),
    end: date = Query(date(2026, 1, 31), description="End delivery date"),
    cutoff_hour: str = Query(
        "09:00", pattern=r"^\d{2}:\d{2}$", description="Cutoff time in London"
    ),
    dm: DataManager = Depends(get_data_manager),
) -> list[HorizonBucketBreakdown]:
    """Breakdown of forecast errors by lead horizon bucket."""
    if start > end:
        raise HTTPException(
            status_code=400, detail="start date must be before or equal to end date"
        )
    aligned_df = dm.get_aligned_timeseries(start, end, cutoff_hour)
    breakdowns = compute_error_breakdowns(aligned_df)
    res = []
    for _, row in breakdowns["by_horizon"].iterrows():
        if pd_isna(row["mae"]):
            continue
        res.append(
            HorizonBucketBreakdown(
                horizon_bucket=str(row["horizon_bucket"]),
                count=int(row["count"]),
                mae_mw=round(float(row["mae"]), 2),
                rmse_mw=round(float(row["rmse"]), 2),
                mean_bias_mw=round(float(row["mean_bias"]), 2),
            )
        )
    return res


@router.get(
    "/accuracy/by-hour",
    response_model=list[HourOfDayBreakdown],
    summary="Error breakdown by hour of day",
)
async def get_accuracy_by_hour(
    start: date = Query(date(2026, 1, 1), description="Start delivery date"),
    end: date = Query(date(2026, 1, 31), description="End delivery date"),
    cutoff_hour: str = Query(
        "09:00", pattern=r"^\d{2}:\d{2}$", description="Cutoff time in London"
    ),
    dm: DataManager = Depends(get_data_manager),
) -> list[HourOfDayBreakdown]:
    """Breakdown of forecast errors by clock hour of delivery (0-23 UTC)."""
    if start > end:
        raise HTTPException(
            status_code=400, detail="start date must be before or equal to end date"
        )
    aligned_df = dm.get_aligned_timeseries(start, end, cutoff_hour)
    breakdowns = compute_error_breakdowns(aligned_df)
    res = []
    for _, row in breakdowns["by_hour"].iterrows():
        res.append(
            HourOfDayBreakdown(
                hour=int(row["hour"]),
                count=int(row["count"]),
                mae_mw=round(float(row["mae"]), 2),
                rmse_mw=round(float(row["rmse"]), 2),
                mean_bias_mw=round(float(row["mean_bias"]), 2),
                mean_actual_mw=round(float(row["mean_actual"]), 2),
                mean_forecast_mw=round(float(row["mean_forecast"]), 2),
            )
        )
    return res


@router.get(
    "/accuracy/by-wind-level",
    response_model=list[WindLevelBreakdown],
    summary="Error breakdown by wind regime",
)
async def get_accuracy_by_wind_level(
    start: date = Query(date(2026, 1, 1), description="Start delivery date"),
    end: date = Query(date(2026, 1, 31), description="End delivery date"),
    cutoff_hour: str = Query(
        "09:00", pattern=r"^\d{2}:\d{2}$", description="Cutoff time in London"
    ),
    dm: DataManager = Depends(get_data_manager),
) -> list[WindLevelBreakdown]:
    """Breakdown of forecast errors by actual wind generation level."""
    if start > end:
        raise HTTPException(
            status_code=400, detail="start date must be before or equal to end date"
        )
    aligned_df = dm.get_aligned_timeseries(start, end, cutoff_hour)
    breakdowns = compute_error_breakdowns(aligned_df)
    res = []
    for _, row in breakdowns["by_wind_level"].iterrows():
        if pd_isna(row["mae"]):
            continue
        res.append(
            WindLevelBreakdown(
                wind_level=str(row["wind_level"]),
                count=int(row["count"]),
                mae_mw=round(float(row["mae"]), 2),
                rmse_mw=round(float(row["rmse"]), 2),
                mean_bias_mw=round(float(row["mean_bias"]), 2),
                nmae_pct=round(float(row["nmae_pct"]), 2),
            )
        )
    return res


@router.get(
    "/accuracy/daily",
    response_model=list[DailyBreakdown],
    summary="Daily accuracy metrics",
)
async def get_accuracy_daily(
    start: date = Query(date(2026, 1, 1), description="Start delivery date"),
    end: date = Query(date(2026, 1, 31), description="End delivery date"),
    cutoff_hour: str = Query(
        "09:00", pattern=r"^\d{2}:\d{2}$", description="Cutoff time in London"
    ),
    dm: DataManager = Depends(get_data_manager),
) -> list[DailyBreakdown]:
    """Daily time series of accuracy metrics for trend visualization."""
    if start > end:
        raise HTTPException(
            status_code=400, detail="start date must be before or equal to end date"
        )
    aligned_df = dm.get_aligned_timeseries(start, end, cutoff_hour)
    breakdowns = compute_error_breakdowns(aligned_df)
    res = []
    for _, row in breakdowns["by_day"].iterrows():
        res.append(
            DailyBreakdown(
                delivery_date=row["date"],
                count=int(row["count"]),
                mae_mw=round(float(row["mae"]), 2),
                rmse_mw=round(float(row["rmse"]), 2),
                mean_bias_mw=round(float(row["mean_bias"]), 2),
                mean_actual_mw=round(float(row["mean_actual"]), 2),
                mean_forecast_mw=round(float(row["mean_forecast"]), 2),
            )
        )
    return res


@router.get(
    "/accuracy/timeseries",
    response_model=list[TimeseriesComparisonPoint],
    summary="Actual vs forecast time series",
)
async def get_accuracy_timeseries(
    start: date = Query(date(2026, 1, 1)),
    end: date = Query(date(2026, 1, 7)),
    cutoff_hour: str = Query("09:00"),
    dm: DataManager = Depends(get_data_manager),
) -> list[TimeseriesComparisonPoint]:
    """Paired time series of actuals and decision forecasts."""
    if start > end:
        raise HTTPException(
            status_code=400, detail="start date must be before or equal to end date"
        )

    aligned_df = dm.get_aligned_timeseries(start, end, cutoff_hour)
    res = []
    for _, row in aligned_df.iterrows():
        res.append(
            TimeseriesComparisonPoint(
                target_start=row["target_start"],
                settlement_period=int(row["settlementPeriod"]),
                actual_mw=(
                    float(row["actual_mw"]) if not pd_isna(row["actual_mw"]) else None
                ),
                forecast_mw=(
                    float(row["forecast_mw"])
                    if not pd_isna(row["forecast_mw"])
                    else None
                ),
                error_mw=(
                    float(row["error_mw"]) if not pd_isna(row["error_mw"]) else None
                ),
                abs_error_mw=(
                    float(row["abs_error_mw"])
                    if not pd_isna(row["abs_error_mw"])
                    else None
                ),
                horizon_hours=(
                    float(row["horizon_hours"])
                    if not pd_isna(row["horizon_hours"])
                    else None
                ),
            )
        )
    return res


def pd_isna(val: Any) -> bool:
    """Helper to detect pandas NaT or NaN."""
    import pandas as pd

    return bool(pd.isna(val))
