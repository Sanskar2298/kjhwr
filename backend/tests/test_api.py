"""Integration tests for all FastAPI endpoints using httpx / TestClient."""

from datetime import date
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoints():
    """Verify health endpoints respond with 200 and schema."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_meta_endpoint():
    """Verify /api/meta returns data range bounds and default cutoff configuration."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/meta")
        assert resp.status_code == 200
        data = resp.json()
        assert "min_delivery_date" in data
        assert "max_delivery_date" in data
        assert data["default_cutoff_hour"] == "09:00"
        assert data["timezone"] == "Europe/London"
        assert data["total_periods_available"] > 0


@pytest.mark.asyncio
async def test_decision_forecast_endpoint():
    """Verify /api/forecast/decision returns 48 periods, uncertainty bands, and publish times."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/forecast/decision?delivery_date=2026-01-15&cutoff_hour=09:00")
        assert resp.status_code == 200
        data = resp.json()
        assert data["delivery_date"] == "2026-01-15"
        assert data["cutoff_hour"] == "09:00"
        assert len(data["points"]) == 48
        first_pt = data["points"][0]
        assert first_pt["settlement_period"] == 1
        assert "forecast_mw" in first_pt
        assert "band_p10_mw" in first_pt
        assert "band_p90_mw" in first_pt
        assert "publish_time" in first_pt


@pytest.mark.asyncio
async def test_forecast_evolution_endpoint():
    """Verify /api/forecast/evolution returns sequential updates for a target delivery start."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        target_iso = "2026-01-15T12:00:00Z"
        resp = await client.get(f"/api/forecast/evolution?target={target_iso}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["revisions"]) > 0
        assert "generation_mw" in data["revisions"][0]
        assert "horizon_hours" in data["revisions"][0]


@pytest.mark.asyncio
async def test_actuals_endpoint():
    """Verify /api/actuals returns outturn settlement periods."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/actuals?start=2026-01-01&end=2026-01-02")
        assert resp.status_code == 200
        data = resp.json()
        # 2 days * 48 = 96 periods
        assert data["count"] == 96
        assert data["actuals"][0]["fuel_type"] == "WIND"


@pytest.mark.asyncio
async def test_accuracy_summary_endpoint():
    """Verify /api/accuracy/summary computes valid statistical KPIs."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/accuracy/summary?start=2026-01-01&end=2026-01-07&cutoff_hour=09:00")
        assert resp.status_code == 200
        data = resp.json()
        assert data["n_intervals"] == 7 * 48
        assert data["mae_mw"] > 0
        assert data["rmse_mw"] > 0
        assert "mean_bias_mw" in data
        assert "nmae_pct" in data


@pytest.mark.asyncio
async def test_accuracy_breakdown_endpoints():
    """Verify breakdown endpoints: /by-horizon, /by-hour, /by-wind-level, /daily."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Horizon
        r_hor = await client.get("/api/accuracy/by-horizon?start=2026-01-01&end=2026-01-07")
        assert r_hor.status_code == 200
        assert len(r_hor.json()) > 0

        # Hour
        r_hour = await client.get("/api/accuracy/by-hour?start=2026-01-01&end=2026-01-07")
        assert r_hour.status_code == 200
        assert len(r_hour.json()) == 24

        # Wind level
        r_wind = await client.get("/api/accuracy/by-wind-level?start=2026-01-01&end=2026-01-07")
        assert r_wind.status_code == 200
        assert len(r_wind.json()) > 0

        # Daily
        r_day = await client.get("/api/accuracy/daily?start=2026-01-01&end=2026-01-07")
        assert r_day.status_code == 200
        assert len(r_day.json()) == 7


@pytest.mark.asyncio
async def test_accuracy_timeseries_endpoint():
    """Verify /api/accuracy/timeseries returns aligned pairs."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/accuracy/timeseries?start=2026-01-01&end=2026-01-02")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 96
        assert "actual_mw" in data[0]
        assert "forecast_mw" in data[0]
        assert "error_mw" in data[0]


@pytest.mark.asyncio
async def test_validation_error_handling():
    """Ensure invalid date ranges return clean 400 Bad Request."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/actuals?start=2026-01-10&end=2026-01-05")
        assert resp.status_code == 400
        assert "start date must be before or equal to end date" in resp.json()["detail"]
