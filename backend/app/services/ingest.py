"""Service module for ingesting, validating, and persisting Elexon BMRS datasets.

Implements resilient HTTP fetching with exponential backoff, request chunking,
Pydantic validation, raw JSON caching, and cleaned Parquet/CSV persistence.
"""

import json
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx
import pandas as pd
from pydantic import ValidationError

from app.models.ingestion import FuelHHRecord, IngestionQualityReport, WindforRecord

logger = logging.getLogger("ingestion_service")

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"


class BMRSIngestionService:
    """Manages downloading, validating, and processing FUELHH and WINDFOR data."""

    def __init__(
        self,
        base_url: str = ELEXON_BASE_URL,
        raw_dir: str = "data/raw",
        processed_dir: str = "data/processed",
        client: Optional[httpx.Client] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.raw_dir = Path(raw_dir)
        self.processed_dir = Path(processed_dir)
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self._client = client

    def _get_client(self) -> httpx.Client:
        """Provide an HTTP client with realistic headers and timeout."""
        if self._client is not None:
            return self._client
        return httpx.Client(
            headers={"User-Agent": "UK-Wind-Evaluator/0.1.0 (Day-Ahead Trading Support)"},
            timeout=30.0,
        )

    def fetch_with_retry(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 4,
        backoff_factor: float = 1.5,
    ) -> List[Dict[str, Any]]:
        """Fetch JSON data from Elexon API with exponential backoff on transient errors.

        Args:
            url: Target API endpoint.
            params: Query parameters.
            max_retries: Maximum retry attempts for 5xx or rate limit responses.
            backoff_factor: Multiplier for exponential backoff delay.

        Returns:
            List[Dict[str, Any]]: Parsed JSON list.

        Raises:
            httpx.HTTPStatusError: On unrecoverable or repeated HTTP errors.
        """
        client = self._get_client()
        attempt = 0
        while attempt < max_retries:
            try:
                logger.info(f"Requesting {url} with params {params} (attempt {attempt + 1}/{max_retries})")
                response = client.get(url, params=params)
                if response.status_code == 200:
                    payload = response.json()
                    # Handled both stream list and wrapper dict
                    if isinstance(payload, dict) and "data" in payload:
                        return payload["data"]
                    return payload
                elif response.status_code in (429, 500, 502, 503, 504):
                    logger.warning(
                        f"Transient HTTP {response.status_code} received from Elexon. Retrying..."
                    )
                else:
                    response.raise_for_status()
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                if attempt == max_retries - 1:
                    logger.error(f"Failed to fetch {url} after {max_retries} attempts: {exc}")
                    raise
                logger.warning(f"Network error: {exc}. Retrying...")

            attempt += 1
            delay = backoff_factor ** attempt
            time.sleep(delay)

        raise RuntimeError(f"Exhausted retries fetching {url}")

    def fetch_fuelhh_chunked(
        self,
        start_date: date,
        end_date: date,
        chunk_days: int = 14,
    ) -> List[FuelHHRecord]:
        """Fetch and validate FUELHH wind generation actuals in safe time chunks.

        The API restricts date spans to <= 31 days. Chunking into 14-day segments
        ensures requests stay safely within limits and minimizes payload size.

        Args:
            start_date: Inclusive start settlement date.
            end_date: Inclusive end settlement date.
            chunk_days: Number of days per query batch.

        Returns:
            List[FuelHHRecord]: Cleaned and validated FUELHH models.
        """
        records: List[FuelHHRecord] = []
        curr_start = start_date

        while curr_start <= end_date:
            curr_end = min(curr_start + timedelta(days=chunk_days - 1), end_date)
            url = f"{self.base_url}/datasets/FUELHH/stream"
            params = {
                "settlementDateFrom": curr_start.strftime("%Y-%m-%d"),
                "settlementDateTo": curr_end.strftime("%Y-%m-%d"),
                "fuelType": "WIND",
            }
            raw_data = self.fetch_with_retry(url, params=params)

            # Persist raw chunk for offline auditability
            cache_file = self.raw_dir / f"fuelhh_{curr_start}_{curr_end}.json"
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(raw_data, f, indent=2)

            for item in raw_data:
                try:
                    records.append(FuelHHRecord(**item))
                except ValidationError as e:
                    logger.warning(f"Skipping malformed FUELHH record: {e}")

            curr_start = curr_end + timedelta(days=1)

        # Deduplicate records by (settlementDate, settlementPeriod, startTime)
        deduped: Dict[Tuple[str, int, datetime], FuelHHRecord] = {}
        for r in records:
            deduped[(r.settlementDate, r.settlementPeriod, r.startTime)] = r

        logger.info(f"Ingested {len(deduped)} unique FUELHH records from {start_date} to {end_date}")
        return list(deduped.values())

    def fetch_windfor_chunked(
        self,
        publish_from: datetime,
        publish_to: datetime,
        chunk_days: int = 10,
    ) -> List[WindforRecord]:
        """Fetch and validate WINDFOR forecasts chunked by publication timestamp.

        Args:
            publish_from: Inclusive start publication timestamp (UTC).
            publish_to: Inclusive end publication timestamp (UTC).
            chunk_days: Days per chunk to avoid hitting 31-day API limits.

        Returns:
            List[WindforRecord]: Cleaned and validated WINDFOR models.
        """
        records: List[WindforRecord] = []
        curr_start = publish_from

        while curr_start <= publish_to:
            curr_end = min(curr_start + timedelta(days=chunk_days), publish_to)
            url = f"{self.base_url}/datasets/WINDFOR/stream"
            params = {
                "publishDateTimeFrom": curr_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "publishDateTimeTo": curr_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            raw_data = self.fetch_with_retry(url, params=params)

            # Persist raw chunk for auditability
            cache_file = (
                self.raw_dir
                / f"windfor_{curr_start.strftime('%Y%m%d%H%M')}_{curr_end.strftime('%Y%m%d%H%M')}.json"
            )
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(raw_data, f, indent=2)

            for item in raw_data:
                try:
                    records.append(WindforRecord(**item))
                except ValidationError as e:
                    logger.warning(f"Skipping malformed WINDFOR record: {e}")

            curr_start = curr_end + timedelta(seconds=1)

        # Deduplicate by (publishTime, startTime)
        deduped: Dict[Tuple[datetime, datetime], WindforRecord] = {}
        for r in records:
            deduped[(r.publishTime, r.startTime)] = r

        logger.info(f"Ingested {len(deduped)} unique WINDFOR records.")
        return list(deduped.values())

    def run_pipeline(
        self,
        decision_start_date: date = date(2026, 1, 1),
        decision_end_date: date = date(2026, 1, 31),
    ) -> IngestionQualityReport:
        """Run the full ingestion and validation pipeline for the January 2026 scope.

        Coverage rationale:
        - Day-ahead decisions made on 2026-01-01 at 12:00 decide delivery for 2026-01-02.
        - Day-ahead decisions made on 2026-01-31 at 12:00 decide delivery for 2026-02-01.
        - To cover deliveries starting 2026-01-01 (decided on 2025-12-31), WINDFOR starts 2025-12-30.
        - FUELHH covers delivery settlement dates 2026-01-01 through 2026-02-01.

        Args:
            decision_start_date: Start of decision evaluation window.
            decision_end_date: End of decision evaluation window.

        Returns:
            IngestionQualityReport: Summary of row counts, date ranges, and distributions.
        """
        # Define exact query windows
        fuelhh_start = decision_start_date
        fuelhh_end = decision_end_date + timedelta(days=1)  # Cover up to Feb 1 outturns

        windfor_start = datetime(2025, 12, 30, 0, 0, tzinfo=timezone.utc)
        windfor_end = datetime(2026, 1, 31, 23, 59, 59, tzinfo=timezone.utc)

        logger.info("Executing FUELHH ingestion...")
        fuelhh_records = self.fetch_fuelhh_chunked(fuelhh_start, fuelhh_end)

        logger.info("Executing WINDFOR ingestion...")
        windfor_records = self.fetch_windfor_chunked(windfor_start, windfor_end)

        # Convert to DataFrames and save processed files
        fuelhh_df = pd.DataFrame([r.model_dump() for r in fuelhh_records])
        windfor_df = pd.DataFrame([r.model_dump() for r in windfor_records])

        # Write clean parquet and CSV files
        fuelhh_parquet = self.processed_dir / "fuelhh_actuals.parquet"
        fuelhh_csv = self.processed_dir / "fuelhh_actuals.csv"
        windfor_parquet = self.processed_dir / "windfor_forecasts.parquet"
        windfor_csv = self.processed_dir / "windfor_forecasts.csv"

        fuelhh_df.to_parquet(fuelhh_parquet, index=False)
        fuelhh_df.to_csv(fuelhh_csv, index=False)
        windfor_df.to_parquet(windfor_parquet, index=False)
        windfor_df.to_csv(windfor_csv, index=False)
        logger.info(f"Saved processed datasets to {self.processed_dir}")

        # Compute Quality Report metrics
        fuelhh_df["startTime"] = pd.to_datetime(fuelhh_df["startTime"], utc=True)
        windfor_df["startTime"] = pd.to_datetime(windfor_df["startTime"], utc=True)
        windfor_df["publishTime"] = pd.to_datetime(windfor_df["publishTime"], utc=True)

        # Missing settlement periods check
        expected_periods = (fuelhh_end - fuelhh_start).days + 1
        expected_total_hh = expected_periods * 48
        missing_periods = max(0, expected_total_hh - len(fuelhh_df))

        # Lead time / horizon distribution
        lead_hours = (windfor_df["startTime"] - windfor_df["publishTime"]).dt.total_seconds() / 3600.0
        lead_dist = {
            "retrospective_lt_0h": int((lead_hours < 0).sum()),
            "intraday_0h_to_24h": int(((lead_hours >= 0) & (lead_hours < 24)).sum()),
            "day_ahead_24h_to_48h": int(((lead_hours >= 24) & (lead_hours < 48)).sum()),
            "medium_range_gte_48h": int((lead_hours >= 48).sum()),
        }

        report = IngestionQualityReport(
            fuelhh_count=len(fuelhh_df),
            fuelhh_min_start=fuelhh_df["startTime"].min().to_pydatetime(),
            fuelhh_max_start=fuelhh_df["startTime"].max().to_pydatetime(),
            fuelhh_missing_settlement_periods=missing_periods,
            windfor_count=len(windfor_df),
            windfor_min_publish=windfor_df["publishTime"].min().to_pydatetime(),
            windfor_max_publish=windfor_df["publishTime"].max().to_pydatetime(),
            windfor_min_start=windfor_df["startTime"].min().to_pydatetime(),
            windfor_max_start=windfor_df["startTime"].max().to_pydatetime(),
            windfor_unique_publish_batches=int(windfor_df["publishTime"].nunique()),
            lead_time_distribution_hours=lead_dist,
        )
        return report
