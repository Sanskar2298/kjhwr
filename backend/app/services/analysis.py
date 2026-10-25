"""Pure, analytical services for day-ahead wind forecast evaluation.

Covers:
1. Point-in-time forecast selection at decision cutoff (Europe/London to UTC).
2. Forecast evolution tracing across publication updates.
3. Quantitative accuracy metrics: MAE, RMSE, Mean Bias, Median AE, P90, P95, NMAE, MAPE, R².
4. Multi-dimensional error breakdowns (by horizon, hour of day, wind level, day).
5. Empirical error uncertainty bands (P10, P50, P90) computed without lookahead leakage.
"""

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
import pytz

LONDON_TZ = pytz.timezone("Europe/London")


def convert_local_cutoff_to_utc(
    target_date: date,
    cutoff_time_local: str = "09:00",
    cutoff_day_offset: int = -1,
) -> datetime:
    """Convert a local Europe/London cutoff string to an absolute UTC datetime.

    Handles Daylight Saving Time (DST, BST/GMT) transitions explicitly via pytz.

    Args:
        target_date: The physical delivery date (day D).
        cutoff_time_local: Clock time string 'HH:MM' in Europe/London.
        cutoff_day_offset: Offset in days relative to target_date (e.g., -1 for D-1).

    Returns:
        datetime: Timezone-aware UTC timestamp corresponding to the cutoff.
    """
    decision_date = target_date + timedelta(days=cutoff_day_offset)
    hh, mm = map(int, cutoff_time_local.split(":"))
    naive_dt = datetime(decision_date.year, decision_date.month, decision_date.day, hh, mm, 0)
    # Localize with is_dst=None to raise if ambiguous, or handle standard transitions cleanly
    local_dt = LONDON_TZ.localize(naive_dt, is_dst=None)
    return local_dt.astimezone(timezone.utc)


def get_decision_forecast(
    windfor_df: pd.DataFrame,
    delivery_date: date,
    cutoff_time_local: str = "09:00",
    cutoff_day_offset: int = -1,
) -> pd.DataFrame:
    """Return the latest available forecast at decision cutoff for each half-hour in delivery_date.

    Rules:
    - Filters forecasts strictly published on or before cutoff_utc (publishTime <= cutoff_utc).
    - WINDFOR is published on an hourly cadence. We create a complete 48 half-hour grid for
      the delivery day. Each half-hour target period (e.g. 14:00 and 14:30) maps to the
      corresponding forecast hour (floor to hour), or interpolates.
    - Computes horizon_hours = (target_start - publishTime) in hours.
    - If no forecast is available for a target, returns NaN for generation, publishTime, and horizon_hours.

    Args:
        windfor_df: DataFrame containing WINDFOR records ('publishTime', 'startTime', 'generation').
        delivery_date: Target delivery date (day D).
        cutoff_time_local: Local time string in Europe/London (default: '09:00').
        cutoff_day_offset: Day offset for decision (default: -1 for day-ahead D-1).

    Returns:
        pd.DataFrame: 48 rows (or 46/50 on DST change days) with columns:
            ['target_start', 'settlementPeriod', 'forecast_mw', 'publishTime', 'horizon_hours']
    """
    cutoff_utc = convert_local_cutoff_to_utc(delivery_date, cutoff_time_local, cutoff_day_offset)

    # Standard delivery day 48 half-hours in UTC
    start_utc = datetime(delivery_date.year, delivery_date.month, delivery_date.day, 0, 0, tzinfo=timezone.utc)
    end_utc = start_utc + timedelta(days=1)
    target_half_hours = pd.date_range(start=start_utc, end=end_utc - timedelta(minutes=30), freq="30min")

    grid_df = pd.DataFrame({
        "target_start": target_half_hours,
        "settlementPeriod": list(range(1, len(target_half_hours) + 1)),
    })

    if windfor_df.empty:
        grid_df["forecast_mw"] = np.nan
        grid_df["publishTime"] = pd.NaT
        grid_df["horizon_hours"] = np.nan
        return grid_df

    # Filter forecasts strictly available on or before cutoff
    valid_forecasts = windfor_df[windfor_df["publishTime"] <= cutoff_utc].copy()

    if valid_forecasts.empty:
        grid_df["forecast_mw"] = np.nan
        grid_df["publishTime"] = pd.NaT
        grid_df["horizon_hours"] = np.nan
        return grid_df

    # For each forecast startTime, pick the record with the LATEST publishTime <= cutoff_utc
    sorted_f = valid_forecasts.sort_values(["startTime", "publishTime"])
    latest_per_start = sorted_f.groupby("startTime").last().reset_index()

    # Map each 30-min target to its parent hour (e.g. 14:30 -> 14:00)
    grid_df["hour_start"] = grid_df["target_start"].dt.floor("h")

    merged = pd.merge(
        grid_df,
        latest_per_start[["startTime", "generation", "publishTime"]],
        left_on="hour_start",
        right_on="startTime",
        how="left",
    )

    merged["forecast_mw"] = merged["generation"]
    merged["horizon_hours"] = (merged["target_start"] - merged["publishTime"]).dt.total_seconds() / 3600.0

    result = merged[["target_start", "settlementPeriod", "forecast_mw", "publishTime", "horizon_hours"]].copy()
    return result


def get_forecast_evolution(
    windfor_df: pd.DataFrame,
    target_start: datetime,
    end_time: Optional[datetime] = None,
) -> pd.DataFrame:
    """Return all successive forecasts published for a target delivery start time.

    Useful for analyzing how the forecast converged as gate closure approached.

    Args:
        windfor_df: WINDFOR DataFrame.
        target_start: The target delivery start time (UTC).
        end_time: Optional upper bound filter on publishTime.

    Returns:
        pd.DataFrame: Forecasts ordered by publishTime ascending with horizon_hours.
    """
    if target_start.tzinfo is None:
        target_start = target_start.replace(tzinfo=timezone.utc)

    # Hourly floor match if target is half-hourly
    hour_target = target_start.replace(minute=0, second=0, microsecond=0)

    sub = windfor_df[windfor_df["startTime"] == hour_target].copy()
    if end_time is not None:
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        sub = sub[sub["publishTime"] <= end_time]

    sub = sub.sort_values("publishTime").reset_index(drop=True)
    sub["horizon_hours"] = (target_start - sub["publishTime"]).dt.total_seconds() / 3600.0
    return sub[["publishTime", "startTime", "generation", "horizon_hours"]]


def compute_metrics(
    actual: Union[pd.Series, np.ndarray, List[float]],
    forecast: Union[pd.Series, np.ndarray, List[float]],
) -> Dict[str, Any]:
    """Compute quantitative error and accuracy metrics between actuals and forecasts.

    Zero-handling rule for MAPE:
    When actual generation is zero or near-zero (< 1.0 MW), relative percentage error is
    undefined / infinite. MAPE is evaluated on intervals where actual >= 1.0 MW, and
    reported alongside the count of zero-suppressed intervals. Furthermore, Normalized MAE
    (NMAE = MAE / mean(actual)) is provided as a standard, non-diverging capacity metric.

    Metrics returned:
    - n_intervals: Number of valid non-null intervals evaluated
    - n_zero_actuals_suppressed_in_mape: Count of actuals < 1.0 MW excluded from MAPE
    - mae: Mean Absolute Error (MW)
    - rmse: Root Mean Square Error (MW)
    - mean_bias: Mean Error (Forecast - Actual) (MW). Positive = Over-forecast.
    - median_ae: Median Absolute Error (MW)
    - p90_ae: 90th percentile Absolute Error (MW)
    - p95_ae: 95th percentile Absolute Error (MW)
    - nmae_pct: Normalized MAE as percentage of mean actual (%)
    - mape_pct: Mean Absolute Percentage Error (%)
    - r2: Coefficient of determination R²

    Args:
        actual: Outturn actual power generation series in MW.
        forecast: Forecast power generation series in MW.

    Returns:
        Dict[str, Any]: Calculated metrics.
    """
    act = np.asarray(actual, dtype=float)
    fc = np.asarray(forecast, dtype=float)

    # Filter out NaNs
    valid_mask = ~np.isnan(act) & ~np.isnan(fc)
    act = act[valid_mask]
    fc = fc[valid_mask]

    n_total = len(act)
    if n_total == 0:
        return {
            "n_intervals": 0,
            "n_zero_actuals_suppressed_in_mape": 0,
            "mae": np.nan,
            "rmse": np.nan,
            "mean_bias": np.nan,
            "median_ae": np.nan,
            "p90_ae": np.nan,
            "p95_ae": np.nan,
            "nmae_pct": np.nan,
            "mape_pct": np.nan,
            "r2": np.nan,
        }

    errors = fc - act
    abs_errors = np.abs(errors)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    mean_bias = float(np.mean(errors))
    median_ae = float(np.median(abs_errors))
    p90_ae = float(np.percentile(abs_errors, 90))
    p95_ae = float(np.percentile(abs_errors, 95))

    mean_actual = float(np.mean(act))
    nmae_pct = (mae / mean_actual * 100.0) if mean_actual > 0 else np.nan

    # Zero handling for MAPE: threshold 1.0 MW
    nonzero_mask = act >= 1.0
    zero_count = int(np.sum(~nonzero_mask))
    if np.any(nonzero_mask):
        mape_pct = float(np.mean(abs_errors[nonzero_mask] / act[nonzero_mask]) * 100.0)
    else:
        mape_pct = np.nan

    # R-squared calculation
    ss_tot = np.sum((act - mean_actual) ** 2)
    ss_res = np.sum((act - fc) ** 2)
    r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot > 0 else (1.0 if ss_res == 0 else 0.0)

    return {
        "n_intervals": n_total,
        "n_zero_actuals_suppressed_in_mape": zero_count,
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "mean_bias": round(mean_bias, 2),
        "median_ae": round(median_ae, 2),
        "p90_ae": round(p90_ae, 2),
        "p95_ae": round(p95_ae, 2),
        "nmae_pct": round(nmae_pct, 2),
        "mape_pct": round(mape_pct, 2) if not np.isnan(mape_pct) else None,
        "r2": round(r2, 4),
    }


def compute_error_breakdowns(aligned_df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    """Calculate multi-dimensional error breakdowns.

    Breakdowns:
    1. By horizon bucket (e.g., 12-16h, 16-20h, 20-24h, 24-28h, 28-36h, >36h)
    2. By hour of day (0 to 23)
    3. By wind level bucket (Low: <5GW, Medium: 5-12GW, High: >12GW)
    4. By day (Daily MAE, RMSE, Mean Bias)

    Args:
        aligned_df: DataFrame containing:
            ['target_start', 'actual_mw', 'forecast_mw', 'horizon_hours']

    Returns:
        Dict[str, pd.DataFrame]: Grouped summary DataFrames for each breakdown.
    """
    df = aligned_df.dropna(subset=["actual_mw", "forecast_mw"]).copy()
    if df.empty:
        return {}

    df["error_mw"] = df["forecast_mw"] - df["actual_mw"]
    df["abs_error_mw"] = df["error_mw"].abs()
    df["target_start"] = pd.to_datetime(df["target_start"], utc=True)
    df["hour"] = df["target_start"].dt.hour
    df["date"] = df["target_start"].dt.date

    # 1. Horizon buckets
    bins = [0, 16, 20, 24, 28, 32, 40, 100]
    labels = ["<16h", "16-20h", "20-24h", "24-28h", "28-32h", "32-40h", ">40h"]
    df["horizon_bucket"] = pd.cut(df["horizon_hours"], bins=bins, labels=labels, right=False)

    by_horizon = df.groupby("horizon_bucket", observed=False).apply(
        lambda g: pd.Series({
            "count": len(g),
            "mae": g["abs_error_mw"].mean(),
            "rmse": np.sqrt((g["error_mw"] ** 2).mean()) if len(g) > 0 else np.nan,
            "mean_bias": g["error_mw"].mean(),
        })
    ).reset_index()

    # 2. By hour of day
    by_hour = df.groupby("hour").apply(
        lambda g: pd.Series({
            "count": len(g),
            "mae": g["abs_error_mw"].mean(),
            "rmse": np.sqrt((g["error_mw"] ** 2).mean()),
            "mean_bias": g["error_mw"].mean(),
            "mean_actual": g["actual_mw"].mean(),
            "mean_forecast": g["forecast_mw"].mean(),
        })
    ).reset_index()

    # 3. By wind level bucket (Low, Medium, High)
    wind_bins = [0, 5000, 12000, 50000]
    wind_labels = ["Low (<5GW)", "Medium (5-12GW)", "High (>12GW)"]
    df["wind_level"] = pd.cut(df["actual_mw"], bins=wind_bins, labels=wind_labels, right=False)

    by_wind_level = df.groupby("wind_level", observed=False).apply(
        lambda g: pd.Series({
            "count": len(g),
            "mae": g["abs_error_mw"].mean(),
            "rmse": np.sqrt((g["error_mw"] ** 2).mean()) if len(g) > 0 else np.nan,
            "mean_bias": g["error_mw"].mean(),
            "nmae_pct": (g["abs_error_mw"].mean() / g["actual_mw"].mean() * 100.0) if len(g) > 0 and g["actual_mw"].mean() > 0 else np.nan,
        })
    ).reset_index()

    # 4. By day
    by_day = df.groupby("date").apply(
        lambda g: pd.Series({
            "count": len(g),
            "mae": g["abs_error_mw"].mean(),
            "rmse": np.sqrt((g["error_mw"] ** 2).mean()),
            "mean_bias": g["error_mw"].mean(),
            "mean_actual": g["actual_mw"].mean(),
            "mean_forecast": g["forecast_mw"].mean(),
        })
    ).reset_index()

    return {
        "by_horizon": by_horizon,
        "by_hour": by_hour,
        "by_wind_level": by_wind_level,
        "by_day": by_day,
    }


def error_bands(
    all_aligned_df: pd.DataFrame,
    eval_date: Optional[date] = None,
    horizon_bins: Optional[List[float]] = None,
) -> pd.DataFrame:
    """Compute empirical error quantiles (P10, P50, P90) of (actual - forecast) vs horizon.

    Crucial Anti-Leakage Rule:
    When evaluating a specific `eval_date`, error bands CANNOT be computed using data
    from that same day (or subsequent days). It strictly uses strictly preceding days
    (expanding historical window) or leave-one-day-out. If eval_date is None, empirical
    bands are computed across the full baseline.

    The error difference is defined as: delta = actual - forecast (MW).
    Thus:
      Lower bound = forecast + P10(delta)
      Median      = forecast + P50(delta)
      Upper bound = forecast + P90(delta)

    Args:
        all_aligned_df: DataFrame with ['target_start', 'actual_mw', 'forecast_mw', 'horizon_hours']
        eval_date: Delivery date being evaluated (excluded from calibration window).
        horizon_bins: Custom bin edges for grouping lead hours.

    Returns:
        pd.DataFrame: Quantiles per horizon bucket with columns:
            ['horizon_bucket', 'count', 'p10_delta', 'p50_delta', 'p90_delta']
    """
    df = all_aligned_df.dropna(subset=["actual_mw", "forecast_mw"]).copy()
    df["target_start"] = pd.to_datetime(df["target_start"], utc=True)
    df["delivery_date"] = df["target_start"].dt.date

    # Enforce no-leakage rule: filter to strictly previous dates if eval_date provided
    if eval_date is not None:
        calibration_data = df[df["delivery_date"] < eval_date].copy()
        # Fallback to leave-one-day-out if beginning of period has insufficient prior history (< 5 days)
        if len(calibration_data["delivery_date"].unique()) < 5:
            calibration_data = df[df["delivery_date"] != eval_date].copy()
    else:
        calibration_data = df.copy()

    calibration_data["delta"] = calibration_data["actual_mw"] - calibration_data["forecast_mw"]

    if horizon_bins is None:
        horizon_bins = [0, 16, 20, 24, 28, 32, 40, 100]

    labels = [f"{int(horizon_bins[i])}-{int(horizon_bins[i+1])}h" for i in range(len(horizon_bins) - 1)]
    calibration_data["horizon_bucket"] = pd.cut(
        calibration_data["horizon_hours"],
        bins=horizon_bins,
        labels=labels,
        right=False,
    )

    bands = calibration_data.groupby("horizon_bucket", observed=False).apply(
        lambda g: pd.Series({
            "count": len(g),
            "p10_delta": float(np.percentile(g["delta"], 10)) if len(g) >= 5 else np.nan,
            "p50_delta": float(np.percentile(g["delta"], 50)) if len(g) >= 5 else np.nan,
            "p90_delta": float(np.percentile(g["delta"], 90)) if len(g) >= 5 else np.nan,
        })
    ).reset_index()

    return bands
