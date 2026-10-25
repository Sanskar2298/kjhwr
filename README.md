# UK Day-Ahead Wind Generation Forecast Evaluation Platform

An end-to-end full-stack analytical platform designed for a UK energy utility buying power on the day-ahead power market.

## Overview
- **Decision Context**: Utilities commit physical positions on Day-Ahead (D-1) auctions based on forecasts available prior to decision gate closure (e.g. 12:00 Europe/London).
- **Core Capabilities**:
  1. Identifies the latest available national wind generation forecast (`WINDFOR`) strictly known at decision time for each settlement period in the January 2026 scope.
  2. Aligns forecasts against actual outturn wind generation (`FUELHH`, `fuelType=WIND`) across all 48 half-hour settlement periods per day.
  3. Computes quantitative accuracy metrics: Mean Absolute Error (MAE), Root Mean Square Error (RMSE), Mean Bias (MBE), and Normalized MAE.
  4. Delivers an interactive operations dashboard with visual forecast-versus-actual charts, error distribution, and day-ahead decision time parameter tuning.

## Tech Stack
- **Backend**: Python 3.11, FastAPI, Pydantic v2, Pandas, Pytest, Uvicorn.
- **Frontend**: React 19, TypeScript, Vite, Vitest, Testing Library.
- **Data Source**: Official Elexon BMRS Insights Solution API (`/datasets/FUELHH` and `/datasets/WINDFOR`).
- **Orchestration & Deployment**: Docker, Docker Compose, Vercel configuration ready.

## Quickstart

### 1. Local Environment Setup
```bash
# Copy environment configuration
cp .env.example .env

# Backend setup (Python 3.11)
cd backend
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Frontend setup (Node 20+)
cd frontend
npm install
cd ..
```

### 2. Running with Docker Compose
```bash
make dev
# Frontend accessible at http://localhost:5173
# Backend accessible at http://localhost:8000 (Docs: http://localhost:8000/docs)
```

### 3. Running Ingestion
```bash
make ingest
```

### 4. Running Tests
```bash
make test
```
