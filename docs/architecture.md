# Architecture Diagram & Data Flow

This document details the system design, Elexon BMRS ingestion, day-ahead alignment pipeline, and API/UI architecture.

```mermaid
flowchart TD
    subgraph External["External Data Source (Elexon BMRS Insights API)"]
        BMRS_WINDFOR["WINDFOR Dataset<br/>(Forecast: startTime, publishTime, generation MW)"]
        BMRS_FUELHH["FUELHH Dataset<br/>(Actuals: startTime, fuelType=WIND, generation MW)"]
    end

    subgraph Ingestion["Ingestion & Alignment Pipeline (/scripts & /backend)"]
        INGEST["ingest_bmrs.py<br/>(Batch fetch / stream cache)"]
        RAW_STORE[("data/raw/<br/>Raw BMRS payloads")]
        ALIGNER["Alignment Engine<br/>• Filters publishTime <= DecisionTime on D-1<br/>• Matches 30-min Settlement Periods<br/>• Handles UTC / Europe:London DST"]
        PROCESSED_STORE[("data/processed/<br/>Aligned Pairs Parquet/JSON")]
    end

    subgraph Backend["FastAPI Backend (/backend)"]
        CORE_CFG["Core Config & Settings (Pydantic)"]
        SERVICES["Analytics & Forecast Services<br/>• Error Metrics: MAE, RMSE, MAPE, Bias<br/>• Ramp-rate & extreme forecast accuracy"]
        API_ROUTERS["REST API Routers<br/>• /api/v1/forecasts/day-ahead<br/>• /api/v1/evaluation/metrics<br/>• /health"]
    end

    subgraph Frontend["React + TypeScript SPA (/frontend)"]
        UI_DASHBOARD["Day-Ahead Wind Operations Dashboard"]
        CHART_VIEW["Time Series Plot (Actual vs Forecast)"]
        METRICS_CARD["Quantitative Accuracy KPIs (MAE, Bias, RMSE)"]
        DECISION_CONTROLLER["Decision Time Selector (e.g. 12:00 vs 17:00 D-1)"]
    end

    BMRS_WINDFOR --> INGEST
    BMRS_FUELHH --> INGEST
    INGEST --> RAW_STORE
    RAW_STORE --> ALIGNER
    ALIGNER --> PROCESSED_STORE
    PROCESSED_STORE --> SERVICES
    SERVICES --> API_ROUTERS
    API_ROUTERS --> UI_DASHBOARD
    DECISION_CONTROLLER --> UI_DASHBOARD
    UI_DASHBOARD --> CHART_VIEW
    UI_DASHBOARD --> METRICS_CARD
```

## System Components

1. **Ingestion & Data Pipeline (`/scripts`, `/data`)**:
   - Fetches official half-hourly actual wind generation from `FUELHH` (`fuelType=WIND`).
   - Fetches official wind generation forecasts from `WINDFOR` with publication timestamps.
   - Preserves raw immutable records in `data/raw/`.
   - Aligns forecast points to target delivery periods strictly respecting market decision cutoff times (`publishTime <= D-1 12:00 UTC/London`) into `data/processed/`.

2. **Backend Service (`/backend`)**:
   - Built on FastAPI (Python 3.11).
   - Exposes REST endpoints for querying forecasts available at decision time and quantitative evaluation metrics (MAE, RMSE, Bias/Mean Error, MAPE, P90 absolute errors).
   - Full test coverage with `pytest`.

3. **Frontend Application (`/frontend`)**:
   - Modern React (TypeScript + Vite) single-page application.
   - Real-time time series comparison, metrics cards, settlement period breakdown, and configurable decision time selector.
   - Tested using `vitest` and `@testing-library/react`.
