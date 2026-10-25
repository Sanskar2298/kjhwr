"""Execute full analysis on January 2026 data and extract quantitative findings."""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import numpy as np
import pandas as pd

from app.services.analysis import (
    compute_error_breakdowns,
    compute_metrics,
    error_bands,
    get_decision_forecast,
)

def run_january_2026_analysis():
    data_dir = Path("data/processed")
    fuelhh_path = data_dir / "fuelhh_actuals.parquet"
    windfor_path = data_dir / "windfor_forecasts.parquet"

    fuelhh_df = pd.read_parquet(fuelhh_path)
    windfor_df = pd.read_parquet(windfor_path)

    fuelhh_df["startTime"] = pd.to_datetime(fuelhh_df["startTime"], utc=True)
    windfor_df["startTime"] = pd.to_datetime(windfor_df["startTime"], utc=True)
    windfor_df["publishTime"] = pd.to_datetime(windfor_df["publishTime"], utc=True)

    # Decisions made in January 2026:
    # Decisions made on Day D-1 at 09:00 local (Europe/London) for delivery on Day D.
    # Evaluation covers deliveries from 2026-01-01 to 2026-01-31.
    all_aligned = []
    for day in range(1, 32):
        delivery_d = date(2026, 1, day)
        # Decision at 09:00 D-1
        df_fc = get_decision_forecast(windfor_df, delivery_d, cutoff_time_local="09:00", cutoff_day_offset=-1)
        
        # Merge with actuals
        actual_sub = fuelhh_df[fuelhh_df["startTime"].dt.date == delivery_d].copy()
        merged = pd.merge(
            df_fc,
            actual_sub[["startTime", "generation"]].rename(columns={"generation": "actual_mw"}),
            left_on="target_start",
            right_on="startTime",
            how="inner",
        )
        all_aligned.append(merged)

    full_aligned_df = pd.concat(all_aligned, ignore_index=True)
    
    # Save aligned dataset to data/processed/january_2026_aligned.parquet
    aligned_parquet = data_dir / "january_2026_aligned.parquet"
    full_aligned_df.to_parquet(aligned_parquet, index=False)
    print(f"Aligned records count: {len(full_aligned_df)}")

    # 1. Overall monthly metrics
    metrics = compute_metrics(full_aligned_df["actual_mw"], full_aligned_df["forecast_mw"])
    print("\nOVERALL METRICS (January 2026):")
    print(json.dumps(metrics, indent=2))

    # 2. Breakdowns
    breakdowns = compute_error_breakdowns(full_aligned_df)
    
    print("\nBY HORIZON BUCKET:")
    print(breakdowns["by_horizon"].to_string(index=False))

    print("\nBY WIND LEVEL:")
    print(breakdowns["by_wind_level"].to_string(index=False))

    print("\nBY DAY (Top 5 Worst Days by MAE):")
    by_day_sorted = breakdowns["by_day"].sort_values("mae", ascending=False)
    print(by_day_sorted.head(5).to_string(index=False))

    print("\nBY DAY (Top 5 Best Days by MAE):")
    print(by_day_sorted.tail(5).to_string(index=False))

    # 3. Error bands for an example date (e.g. 2026-01-20)
    sample_bands = error_bands(full_aligned_df, eval_date=date(2026, 1, 20))
    print("\nSAMPLE EMPIRICAL ERROR BANDS (P10, P50, P90 of actual - forecast):")
    print(sample_bands.to_string(index=False))

if __name__ == "__main__":
    run_january_2026_analysis()
