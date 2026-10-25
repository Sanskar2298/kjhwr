"""Data manager service for loading datasets once at startup and caching queries.

Maintains in-memory pre-indexed pandas DataFrames for instantaneous responses.
"""

import logging
from collections import OrderedDict
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from app.core.config import get_settings
from app.services.analysis import (
    convert_local_cutoff_to_utc,
    error_bands,
    get_decision_forecast,
    get_forecast_evolution,
)

logger = logging.getLogger("data_manager")


class DataManager:
    """Singleton data manager that loads processed Parquet files into memory once."""

    _instance: Optional["DataManager"] = None

    def __init__(self):
        settings = get_settings()
        candidate = Path(settings.PROCESSED_DATA_DIR)
        if not candidate.exists():
            # Check relative to backend/ (parents[2]) or repo root (parents[3] or cwd)
            repo_root_candidate = (
                Path(__file__).resolve().parents[3] / "data" / "processed"
            )
            cwd_candidate = Path("data/processed")
            if repo_root_candidate.exists():
                candidate = repo_root_candidate
            elif cwd_candidate.exists():
                candidate = cwd_candidate
        self.processed_dir = candidate
        self.fuelhh_df: pd.DataFrame = pd.DataFrame()
        self.windfor_df: pd.DataFrame = pd.DataFrame()
        self.min_date: date | None = None
        self.max_date: date | None = None
        self._aligned_cache: OrderedDict[tuple[date, date, str], pd.DataFrame] = (
            OrderedDict()
        )
        self._load_datasets()

    @classmethod
    def get_instance(cls) -> "DataManager":
        """Return singleton instance of DataManager."""
        if cls._instance is None:
            cls._instance = DataManager()
        return cls._instance

    def _load_datasets(self) -> None:
        """Load parquet datasets once into memory."""
        fuelhh_file = self.processed_dir / "fuelhh_actuals.parquet"
        windfor_file = self.processed_dir / "windfor_forecasts.parquet"

        # Fallback to CSV if parquet does not exist yet
        if not fuelhh_file.exists():
            fuelhh_file = self.processed_dir / "fuelhh_actuals.csv"
        if not windfor_file.exists():
            windfor_file = self.processed_dir / "windfor_forecasts.csv"

        if fuelhh_file.exists():
            if fuelhh_file.suffix == ".parquet":
                self.fuelhh_df = pd.read_parquet(fuelhh_file)
            else:
                self.fuelhh_df = pd.read_csv(fuelhh_file)
            self.fuelhh_df["startTime"] = pd.to_datetime(
                self.fuelhh_df["startTime"], utc=True
            )
            self.fuelhh_df["publishTime"] = pd.to_datetime(
                self.fuelhh_df["publishTime"], utc=True
            )
            self.fuelhh_df["date"] = self.fuelhh_df["startTime"].dt.date
            self.min_date = self.fuelhh_df["date"].min()
            self.max_date = self.fuelhh_df["date"].max()
            logger.info(
                f"Loaded {len(self.fuelhh_df)} FUELHH records ({self.min_date} to {self.max_date})"
            )
        else:
            logger.warning(f"FUELHH dataset not found at {fuelhh_file}")

        if windfor_file.exists():
            if windfor_file.suffix == ".parquet":
                self.windfor_df = pd.read_parquet(windfor_file)
            else:
                self.windfor_df = pd.read_csv(windfor_file)
            self.windfor_df["startTime"] = pd.to_datetime(
                self.windfor_df["startTime"], utc=True
            )
            self.windfor_df["publishTime"] = pd.to_datetime(
                self.windfor_df["publishTime"], utc=True
            )
            logger.info(f"Loaded {len(self.windfor_df)} WINDFOR records")
        else:
            logger.warning(f"WINDFOR dataset not found at {windfor_file}")

    def get_meta(self) -> dict[str, Any]:
        """Return system date bounds and configurations."""
        return {
            "min_delivery_date": self.min_date or date(2026, 1, 1),
            "max_delivery_date": self.max_date or date(2026, 1, 31),
            "default_delivery_date": date(2026, 1, 15),
            "default_cutoff_hour": "09:00",
            "timezone": "Europe/London",
            "total_periods_available": len(self.fuelhh_df),
        }

    def get_decision_forecast_with_bands(
        self,
        delivery_date: date,
        cutoff_hour: str = "09:00",
    ) -> tuple[pd.DataFrame, datetime]:
        """Compute decision forecast along with empirical P10/P50/P90 uncertainty bands."""
        cutoff_utc = convert_local_cutoff_to_utc(
            delivery_date, cutoff_time_local=cutoff_hour, cutoff_day_offset=-1
        )
        fc_df = get_decision_forecast(
            self.windfor_df,
            delivery_date,
            cutoff_time_local=cutoff_hour,
            cutoff_day_offset=-1,
        )

        # Build baseline aligned pairs for empirical error bands
        all_aligned = self.get_aligned_timeseries(
            self.min_date or date(2026, 1, 1),
            self.max_date or date(2026, 1, 31),
            cutoff_hour,
        )
        bands_df = error_bands(all_aligned, eval_date=delivery_date)

        # Merge bands based on horizon bucket
        bins = [0, 16, 20, 24, 28, 32, 40, 100]
        labels = [f"{int(bins[i])}-{int(bins[i+1])}h" for i in range(len(bins) - 1)]
        fc_df["horizon_bucket"] = pd.cut(
            fc_df["horizon_hours"], bins=bins, labels=labels, right=False
        )

        merged = pd.merge(fc_df, bands_df, on="horizon_bucket", how="left")
        merged["band_p10_mw"] = merged["forecast_mw"] + merged["p10_delta"]
        merged["band_p50_mw"] = merged["forecast_mw"] + merged["p50_delta"]
        merged["band_p90_mw"] = merged["forecast_mw"] + merged["p90_delta"]

        return merged, cutoff_utc

    def get_evolution(self, target_start: datetime) -> pd.DataFrame:
        """Fetch sequential forecast updates for a target delivery start."""
        return get_forecast_evolution(self.windfor_df, target_start)

    def get_actuals(self, start_date: date, end_date: date) -> pd.DataFrame:
        """Fetch outturn actuals in date range."""
        mask = (self.fuelhh_df["date"] >= start_date) & (
            self.fuelhh_df["date"] <= end_date
        )
        return self.fuelhh_df[mask].sort_values("startTime").copy()

    def get_aligned_timeseries(
        self,
        start_date: date,
        end_date: date,
        cutoff_hour: str = "09:00",
    ) -> pd.DataFrame:
        """Return aligned actuals and decision forecasts for a date range with LRU caching."""
        cache_key = (start_date, end_date, cutoff_hour)
        if cache_key in self._aligned_cache:
            self._aligned_cache.move_to_end(cache_key)
            return self._aligned_cache[cache_key]

        curr_d = start_date
        chunks = []
        while curr_d <= end_date:
            fc_sub = get_decision_forecast(
                self.windfor_df,
                curr_d,
                cutoff_time_local=cutoff_hour,
                cutoff_day_offset=-1,
            )
            act_sub = self.fuelhh_df[self.fuelhh_df["date"] == curr_d]

            merged = pd.merge(
                fc_sub,
                act_sub[["startTime", "generation"]].rename(
                    columns={"generation": "actual_mw"}
                ),
                left_on="target_start",
                right_on="startTime",
                how="left",
            )
            chunks.append(merged)
            curr_d += timedelta(days=1)

        if not chunks:
            return pd.DataFrame()

        full_df = pd.concat(chunks, ignore_index=True)
        full_df["error_mw"] = full_df["forecast_mw"] - full_df["actual_mw"]
        full_df["abs_error_mw"] = full_df["error_mw"].abs()
        self._aligned_cache[cache_key] = full_df
        self._aligned_cache.move_to_end(cache_key)
        if len(self._aligned_cache) > 32:
            self._aligned_cache.popitem(last=False)
        return full_df


@lru_cache(maxsize=1)
def get_data_manager() -> DataManager:
    """Dependency injection helper returning the DataManager singleton."""
    return DataManager.get_instance()
