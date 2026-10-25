"""Unit tests for app.services.analysis module.

Covers:
- Cutoff logic (publishTime <= cutoff, day offsets, hour floor mapping)
- DST edge cases (GMT to BST transition hours in Europe/London)
- Missing forecast data handling (returns NaN gracefully)
- Zero-actual MAPE handling (zero suppression and counter)
- Multi-dimensional breakdown calculations
- Anti-leakage error band logic (excluding evaluation day actuals)
"""

from datetime import UTC, date, datetime, timedelta

import numpy as np
import pandas as pd

from app.services.analysis import (
    compute_error_breakdowns,
    compute_metrics,
    convert_local_cutoff_to_utc,
    error_bands,
    get_decision_forecast,
    get_forecast_evolution,
)


def test_convert_local_cutoff_to_utc_gmt_winter():
    """During January (GMT, UTC+0), 09:00 local should equal 09:00 UTC."""
    delivery = date(2026, 1, 15)
    utc_dt = convert_local_cutoff_to_utc(
        delivery, cutoff_time_local="09:00", cutoff_day_offset=-1
    )
    # D-1 is Jan 14
    assert utc_dt == datetime(2026, 1, 14, 9, 0, tzinfo=UTC)


def test_convert_local_cutoff_to_utc_dst_summer():
    """During BST (British Summer Time, UTC+1), 09:00 local should equal 08:00 UTC."""
    delivery = date(2026, 7, 15)
    utc_dt = convert_local_cutoff_to_utc(
        delivery, cutoff_time_local="09:00", cutoff_day_offset=-1
    )
    # D-1 is July 14, 09:00 BST -> 08:00 UTC
    assert utc_dt == datetime(2026, 7, 14, 8, 0, tzinfo=UTC)


def test_get_decision_forecast_cutoff_and_latest_rule():
    """Ensure get_decision_forecast selects latest forecast <= cutoff and ignores forecasts after cutoff."""
    target_date = date(2026, 1, 2)
    # Forecasts for 2026-01-02 00:00 published at multiple times on 2026-01-01
    windfor_data = [
        # Early forecast before cutoff
        {
            "startTime": datetime(2026, 1, 2, 0, 0, tzinfo=UTC),
            "publishTime": datetime(2026, 1, 1, 6, 0, tzinfo=UTC),
            "generation": 1000.0,
        },
        # Latest forecast strictly BEFORE cutoff (cutoff 09:00)
        {
            "startTime": datetime(2026, 1, 2, 0, 0, tzinfo=UTC),
            "publishTime": datetime(2026, 1, 1, 8, 30, tzinfo=UTC),
            "generation": 1200.0,
        },
        # Forecast published AFTER cutoff (should be ignored!)
        {
            "startTime": datetime(2026, 1, 2, 0, 0, tzinfo=UTC),
            "publishTime": datetime(2026, 1, 1, 11, 30, tzinfo=UTC),
            "generation": 2500.0,
        },
    ]
    df_wind = pd.DataFrame(windfor_data)

    res = get_decision_forecast(
        df_wind, target_date, cutoff_time_local="09:00", cutoff_day_offset=-1
    )
    assert len(res) == 48

    # Target 00:00 (SP 1) should pick the 1200.0 MW forecast published at 08:30
    sp1 = res.iloc[0]
    assert sp1["settlementPeriod"] == 1
    assert sp1["forecast_mw"] == 1200.0
    assert sp1["publishTime"] == datetime(2026, 1, 1, 8, 30, tzinfo=UTC)
    # Horizon = 00:00 Jan 2 minus 08:30 Jan 1 = 15.5 hours
    assert sp1["horizon_hours"] == 15.5

    # Target 00:30 (SP 2) should also map to the same hour 00:00 forecast
    sp2 = res.iloc[1]
    assert sp2["forecast_mw"] == 1200.0
    assert sp2["horizon_hours"] == 16.0


def test_get_decision_forecast_missing_data():
    """Verify that when no forecast is available for a target, it returns NaN without error."""
    target_date = date(2026, 1, 2)
    empty_df = pd.DataFrame(columns=["startTime", "publishTime", "generation"])
    res = get_decision_forecast(empty_df, target_date, cutoff_time_local="09:00")
    assert len(res) == 48
    assert res["forecast_mw"].isna().all()
    assert res["horizon_hours"].isna().all()


def test_get_forecast_evolution():
    """Verify tracing all sequential forecasts for a specific target start time."""
    target_start = datetime(2026, 1, 5, 12, 0, tzinfo=UTC)
    df_wind = pd.DataFrame(
        [
            {
                "startTime": target_start,
                "publishTime": datetime(2026, 1, 4, 6, 0, tzinfo=UTC),
                "generation": 5000.0,
            },
            {
                "startTime": target_start,
                "publishTime": datetime(2026, 1, 4, 18, 0, tzinfo=UTC),
                "generation": 5500.0,
            },
            {
                "startTime": target_start,
                "publishTime": datetime(2026, 1, 5, 6, 0, tzinfo=UTC),
                "generation": 6000.0,
            },
        ]
    )
    evo = get_forecast_evolution(df_wind, target_start)
    assert len(evo) == 3
    assert evo.iloc[0]["generation"] == 5000.0
    assert evo.iloc[-1]["generation"] == 6000.0
    assert evo.iloc[0]["horizon_hours"] == 30.0
    assert evo.iloc[-1]["horizon_hours"] == 6.0


def test_compute_metrics_accuracy_and_zero_handling():
    """Ensure metrics calculate correctly and MAPE safely handles zeros."""
    actuals = [100.0, 200.0, 0.0, 400.0]  # Contains 0.0
    forecasts = [110.0, 180.0, 15.0, 420.0]

    metrics = compute_metrics(actuals, forecasts)
    # Errors: +10, -20, +15, +20 -> Abs: 10, 20, 15, 20
    assert metrics["n_intervals"] == 4
    assert metrics["n_zero_actuals_suppressed_in_mape"] == 1
    assert metrics["mae"] == 16.25  # (10 + 20 + 15 + 20) / 4
    # Mean bias = (10 - 20 + 15 + 20) / 4 = 25 / 4 = 6.25
    assert metrics["mean_bias"] == 6.25
    assert metrics["median_ae"] == 17.5
    # Nonzero actuals for MAPE: 10/100 (10%), 20/200 (10%), 20/400 (5%) -> mean = 8.33%
    assert metrics["mape_pct"] == 8.33


def test_compute_metrics_empty():
    """Ensure graceful handling when actual and forecast arrays are empty."""
    metrics = compute_metrics([], [])
    assert metrics["n_intervals"] == 0
    assert np.isnan(metrics["mae"])


def test_compute_error_breakdowns():
    """Test breakdown by horizon, hour, wind level, and day."""
    base_time = datetime(2026, 1, 10, 0, 0, tzinfo=UTC)
    data = []
    for h in range(48):
        t = base_time + timedelta(minutes=30 * h)
        act = 3000.0 + (h * 200.0)
        fc = act + 500.0  # Constant bias +500 MW
        data.append(
            {
                "target_start": t,
                "actual_mw": act,
                "forecast_mw": fc,
                "horizon_hours": 15.0 + (h * 0.5),
            }
        )
    df = pd.DataFrame(data)
    breakdowns = compute_error_breakdowns(df)

    assert "by_horizon" in breakdowns
    assert "by_hour" in breakdowns
    assert "by_wind_level" in breakdowns
    assert "by_day" in breakdowns
    assert len(breakdowns["by_hour"]) == 24
    assert round(breakdowns["by_hour"]["mean_bias"].mean(), 1) == 500.0


def test_error_bands_anti_leakage():
    """Verify that error bands for a target day do not leak that day's actuals."""
    records = []
    # Generate 10 days of synthetic data
    for day in range(1, 11):
        for h in range(24):
            t = datetime(2026, 1, day, h, 0, tzinfo=UTC)
            # Day 8 has an extreme error outlier (+10,000 MW)
            delta = 10000.0 if day == 8 else 100.0
            records.append(
                {
                    "target_start": t,
                    "actual_mw": 5000.0 + delta,
                    "forecast_mw": 5000.0,
                    "horizon_hours": 20.0,
                }
            )
    df = pd.DataFrame(records)

    # When evaluating Day 8, Day 8's extreme outlier should NOT be in the calibration window
    bands_day8 = error_bands(df, eval_date=date(2026, 1, 8))
    # Days 1 to 7 had delta = 100.0
    row = bands_day8[bands_day8["horizon_bucket"] == "20-24h"].iloc[0]
    assert row["p90_delta"] == 100.0  # Outlier not leaked!
