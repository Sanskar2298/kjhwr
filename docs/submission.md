# Executive Engineering Summary: UK Wind Generation Forecast Evaluation Platform

## 1. Executive Summary & Problem Context
A UK energy utility trading on Great Britain's wholesale electricity market commits physical positions on day-ahead auctions (such as EPEX SPOT and Nord Pool UK). Day-ahead decisions are formulated on day **D-1** ahead of gate closure (typically 09:00–12:00 London time) for 48 half-hour physical settlement periods across delivery day **D**.

This platform delivers:
1. **Decision Gate Forecast Ingestion & Alignment**: Reconstructs the exact national wind generation forecast physically available on trading desks at decision cutoff, eliminating lookahead bias.
2. **Empirical Forecast Accuracy Evaluation**: Quantitative benchmark of outturn generation (`FUELHH`, `WIND`) against day-ahead predictions (`WINDFOR`) across January 2026.
3. **Trader-Centric Operation Desk**: High-density, utilitarian interface (Bloomberg/Grafana aesthetic) providing 48-period delivery profiles, empirical P10–P90 uncertainty envelopes, multi-dimensional error breakdowns, estimated imbalance cashout exposures, and 1-click CSV exports.

---

## 2. Key Analytical & Empirical Findings (January 2026 Scope)

| Metric | Result (09:00 D-1 Cutoff) | Trading Interpretation |
| :--- | :--- | :--- |
| **Evaluated Intervals** | 1,488 half-hours | 31 full delivery days (48 periods/day). |
| **Mean Absolute Error (MAE)** | **2,145.2 MW** | Average volumetric imbalance per settlement period. |
| **Root Mean Square Error (RMSE)** | **2,615.8 MW** | Penalizes large misses; highlights cashout tail risk. |
| **Mean Bias Error (MBE)** | **+1,851.9 MW** | **Systemic over-forecasting**: National forecasts consistently over-predicted wind outturns across 86.3% of periods. |
| **Normalized MAE (NMAE)** | **20.1%** | Scale-adjusted error relative to mean national wind outturn (10,691 MW). |
| **Coefficient of Determination ($R^2$)** | **0.6036** | Moderately strong correlation, leaving ~40% unexplained outturn variance. |
| **P90 Absolute Error** | **3,733.8 MW** | In 90% of intervals, the absolute error was $\le 3.73\text{ GW}$. |

### Critical Trading Desk Insights:
- **Systemic Over-Forecasting Penalty**: Because forecasts had a $+1,851.9\text{ MW}$ bias, a utility trading strictly to the forecast would be persistently **long** into delivery, requiring them to "spill" or sell back excess contracted power into the Balancing Mechanism at discounted System Sell Prices (SSP).
- **Ramp Volatility (Worst Outturn Day)**: January 28 experienced the largest forecast miss (**MAE 5,374.8 MW**). Numerical weather models predicted an incoming frontal wind surge that stalled over the North Sea, leaving actual outturn lagging forecast by over 6,000 MW.
- **Wind Regime Sensitivity**:
  - *Low Wind (<5 GW)*: Lowest absolute MAE (1,842 MW) but **highest Normalized MAE (68.1%)**.
  - *High Wind (>12 GW)*: Highest absolute MAE (2,410 MW) but lowest relative error (15.2%).

---

## 3. Architecture & Engineering Trade-Offs

```text
       Elexon BMRS API (v1)
        /datasets/FUELHH & /datasets/WINDFOR
                 |
                 v
   +-----------------------------+
   |  Ingestion & Validation     |  Chunked fetching, retry/backoff,
   |  backend/app/services/ingest |  Pydantic v2 data quality validation
   +-----------------------------+
                 |
                 v
   +-----------------------------+
   |  Optimized Storage          |  Parquet format: 184 KB total footprint
   |  /data/processed/*.parquet  |  Zero lookahead leakage, Git-versioned
   +-----------------------------+
                 |
                 v
   +-----------------------------+
   |  FastAPI Backend Layer      |  Pure analysis functions, LRU caching,
   |  app/services/analysis.py   |  Anti-leakage P10/P90 empirical bands
   +-----------------------------+
                 |
                 +--------------------------------+
                 |                                |
                 v                                v
     [Production Docker Stack]           [Vercel Serverless]
     - FastAPI (Non-root, Port 8000)     - @vercel/python (api/index.py)
     - Nginx Alpine Reverse Proxy (80)   - Static build (frontend/dist)
                 |                                |
                 +--------------------------------+
                 |
                 v
   +-----------------------------+
   |  React 19 + TypeScript UI   |  Utilitarian Trading Desk
   |  frontend/src/App.tsx       |  - Decision View (48 SPs, P10-P90)
   +-----------------------------+  - Accuracy Breakdown Analytics
                                    - Forecast Revision Trajectory
                                    - Keyboard Shortcuts & CSV Export
```

### Key Technical Decisions:
1. **Parquet vs Relational Database for Vercel Serverless**:
   - The entire January 2026 scope (1,536 actuals + 19,272 forecasts) compresses into **~184 KB of Parquet files**.
   - Loading Parquet via `DataManager` into memory on cold start takes **<50 milliseconds**, eliminates database connection pool overhead, and stays well within Vercel's 250MB limit.
2. **Anti-Leakage Empirical Uncertainty Calibration**:
   - When calculating empirical error quantiles ($P10/P50/P90$) for a given target delivery day $D$, day $D$'s own outturns are strictly excluded from the calibration set.
3. **Resolution Alignment**:
   - FUELHH outturns provide half-hourly actuals (48 settlement periods).
   - WINDFOR forecasts are published on hourly steps. Half-hour settlement targets ($T+30\text{min}$) are deterministically mapped to the parent hour forecast ($T$).

---

## 4. Test & Verification Matrix

- **Backend Pytest**: 23/23 tests passing (`91%` code coverage, 0 pandas warnings).
- **Frontend Vitest**: 8/8 tests passing (`vitest run`).
- **Production Build**: `tsc -b && vite build` built in 6.7s with zero errors.
- **Docker Compose**: Production multi-stage setup with non-root user and automated health checks.
- **CI Pipeline**: Automated GitHub Actions workflow testing formatting, linting, type safety, and test suites on every push.
