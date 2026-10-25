#!/usr/bin/env python3
"""Executable script to ingest, validate, and persist BMRS data for January 2026.

Can be run directly via:
    python scripts/ingest.py
or via:
    make ingest
"""

import sys
import os
import logging
from datetime import date
from pathlib import Path

# Add backend directory to sys.path so app modules can be imported
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.ingest import BMRSIngestionService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ingest_cli")


def main() -> None:
    """Execute ingestion and print formatted data quality report."""
    root_dir = Path(__file__).resolve().parent.parent
    raw_dir = root_dir / "data" / "raw"
    processed_dir = root_dir / "data" / "processed"

    logger.info("Initializing BMRS Ingestion Service...")
    service = BMRSIngestionService(
        raw_dir=str(raw_dir),
        processed_dir=str(processed_dir),
    )

    logger.info("Running ingestion pipeline for January 2026 decisions scope...")
    report = service.run_pipeline(
        decision_start_date=date(2026, 1, 1),
        decision_end_date=date(2026, 1, 31),
    )

    print("\n" + "=" * 70)
    print("           BMRS INGESTION & DATA QUALITY SUMMARY REPORT           ")
    print("=" * 70)
    print("1. FUELHH Actuals (fuelType=WIND):")
    print(f"   • Total records ingested: {report.fuelhh_count:,}")
    print(f"   • Minimum start time:     {report.fuelhh_min_start.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"   • Maximum start time:     {report.fuelhh_max_start.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"   • Missing half-hours:     {report.fuelhh_missing_settlement_periods}")

    print("\n2. WINDFOR Forecasts:")
    print(f"   • Total records ingested: {report.windfor_count:,}")
    print(f"   • Publication date range: {report.windfor_min_publish.strftime('%Y-%m-%d %H:%M:%S %Z')} -> {report.windfor_max_publish.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"   • Target delivery range:  {report.windfor_min_start.strftime('%Y-%m-%d %H:%M:%S %Z')} -> {report.windfor_max_start.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"   • Unique publish batches: {report.windfor_unique_publish_batches:,}")

    print("\n3. Forecast Lead Time Horizon Distribution:")
    for category, count in report.lead_time_distribution_hours.items():
        pct = (count / report.windfor_count) * 100 if report.windfor_count > 0 else 0
        print(f"   • {category.replace('_', ' ').title():<28}: {count:,} ({pct:.1f}%)")

    print("=" * 70)
    print("Ingestion complete. Cleaned datasets written to:")
    print(f"   - {processed_dir / 'fuelhh_actuals.parquet'}")
    print(f"   - {processed_dir / 'windfor_forecasts.parquet'}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
