"""Unit tests for BMRSIngestionService and Pydantic schemas using recorded fixtures.

Tests run offline without making live network calls to Elexon BMRS.
"""

from datetime import date, datetime, timezone
from pathlib import Path
import pytest
import httpx
from pydantic import ValidationError

from app.models.ingestion import FuelHHRecord, WindforRecord
from app.services.ingest import BMRSIngestionService

# Fixture response data representing recorded Elexon stream responses
RECORDED_FUELHH_FIXTURE = [
    {
        "dataset": "FUELHH",
        "publishTime": "2026-01-01T01:00:00Z",
        "startTime": "2026-01-01T00:00:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 1,
        "fuelType": "WIND",
        "generation": 12450.5,
    },
    {
        "dataset": "FUELHH",
        "publishTime": "2026-01-01T01:30:00Z",
        "startTime": "2026-01-01T00:30:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 2,
        "fuelType": "WIND",
        "generation": 12890.0,
    },
    # Duplicate record to test deduplication
    {
        "dataset": "FUELHH",
        "publishTime": "2026-01-01T01:00:00Z",
        "startTime": "2026-01-01T00:00:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 1,
        "fuelType": "WIND",
        "generation": 12450.5,
    },
]

RECORDED_WINDFOR_FIXTURE = [
    {
        "dataset": "WINDFOR",
        "publishTime": "2025-12-31T11:30:00Z",
        "startTime": "2026-01-01T00:00:00Z",
        "generation": 12100.0,
    },
    {
        "dataset": "WINDFOR",
        "publishTime": "2025-12-31T11:30:00Z",
        "startTime": "2026-01-01T01:00:00Z",
        "generation": 12500.0,
    },
    # Duplicate forecast
    {
        "dataset": "WINDFOR",
        "publishTime": "2025-12-31T11:30:00Z",
        "startTime": "2026-01-01T00:00:00Z",
        "generation": 12100.0,
    },
]


def test_fuelhh_validation_success():
    """Verify FuelHHRecord parses valid data and coerces to UTC."""
    record = FuelHHRecord(**RECORDED_FUELHH_FIXTURE[0])
    assert record.dataset == "FUELHH"
    assert record.generation == 12450.5
    assert record.settlementPeriod == 1
    assert record.publishTime.tzinfo == timezone.utc
    assert record.startTime.tzinfo == timezone.utc


def test_fuelhh_validation_rejects_negative_generation():
    """Ensure negative generation is rejected by validation."""
    invalid_data = dict(RECORDED_FUELHH_FIXTURE[0])
    invalid_data["generation"] = -10.0
    with pytest.raises(ValidationError):
        FuelHHRecord(**invalid_data)


def test_windfor_validation_success():
    """Verify WindforRecord parses valid forecast records and enforces UTC."""
    record = WindforRecord(**RECORDED_WINDFOR_FIXTURE[0])
    assert record.dataset == "WINDFOR"
    assert record.generation == 12100.0
    assert record.publishTime.tzinfo == timezone.utc


def test_bmrs_service_mocked_ingestion(tmp_path: Path):
    """Test chunked fetching, deduplication, and persistence using recorded HTTP responses."""
    raw_dir = tmp_path / "raw"
    processed_dir = tmp_path / "processed"

    # Mock transport that returns recorded fixtures
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "FUELHH" in url_str:
            return httpx.Response(200, json=RECORDED_FUELHH_FIXTURE)
        elif "WINDFOR" in url_str:
            return httpx.Response(200, json=RECORDED_WINDFOR_FIXTURE)
        return httpx.Response(404)

    mock_client = httpx.Client(transport=httpx.MockTransport(handler))

    service = BMRSIngestionService(
        base_url="https://mock.elexon.test/api/v1",
        raw_dir=str(raw_dir),
        processed_dir=str(processed_dir),
        client=mock_client,
    )

    # Run FUELHH chunked test
    fuel_records = service.fetch_fuelhh_chunked(
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 1),
    )
    # Ensure deduplication worked (3 fixture items -> 2 unique records)
    assert len(fuel_records) == 2

    # Run WINDFOR chunked test
    wind_records = service.fetch_windfor_chunked(
        publish_from=datetime(2025, 12, 31, 0, 0, tzinfo=timezone.utc),
        publish_to=datetime(2025, 12, 31, 23, 59, tzinfo=timezone.utc),
    )
    # Ensure deduplication worked (3 items -> 2 unique)
    assert len(wind_records) == 2

    # Verify pipeline execution creates processed parquet and CSV files
    report = service.run_pipeline(
        decision_start_date=date(2026, 1, 1),
        decision_end_date=date(2026, 1, 1),
    )

    assert (processed_dir / "fuelhh_actuals.parquet").exists()
    assert (processed_dir / "fuelhh_actuals.csv").exists()
    assert (processed_dir / "windfor_forecasts.parquet").exists()
    assert (processed_dir / "windfor_forecasts.csv").exists()
    assert report.fuelhh_count == 2
    assert report.windfor_count == 2
