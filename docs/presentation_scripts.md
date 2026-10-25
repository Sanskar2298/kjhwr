# Presentation & Walkthrough Scripts (10 Minutes Total)

---

## PART 1: Client Pitch & Commercial Value (Max 5 Minutes)
**Audience:** Head of Trading, Portfolio Manager, Energy Risk Director  
**Tone:** Confident, commercially grounded, actionable, non-technical  
**Target Duration:** ~4 minutes 45 seconds

---

### [00:00 - 00:45] The Commercial Hook & Problem Framing
> *"Good morning. If you buy power on the UK day-ahead market, every megawatt-hour you contract is an exposure to the wind forecast. When the auction closes at 11:00 or 12:00 on day D-1, your physical position is locked.*
> 
> *If outturn generation comes in lower than expected, you are short and forced to buy power at punitive System Buy Prices. If generation comes in higher, you are long and forced to spill excess power at discounted or even negative System Sell Prices.*
> 
> *Today, I’m showing you **Wind Forecast Monitor**: a decision platform built specifically to give trading desks situational awareness at gate closure and quantify your real cashout risk using live Elexon BMRS market data."*

---

### [00:45 - 02:15] Live Product Walkthrough: Decision View
*(Screen share: Web browser on `http://localhost:5173` or live Vercel URL, showing Decision View)*

> *"Let’s look at the trader’s primary workflow: the **Decision View**.
> 
> Right now, we’re evaluating delivery for **January 15th, 2026** at the **09:00 London morning decision gate**.
> 
> Notice what the top filter bar tells the shift trader immediately:
> - The forecast curve you see was published strictly between **07:30 and 07:30 UTC on day D-1**. There is zero lookahead bias—this is exactly the data your desk had on screen before placing bids.
> - Lead horizon ranges from **16.5 hours** for midnight delivery to **40 hours** for the end of the delivery day.
> 
> Looking at our scorecards:
> - Total expected wind generation for the day is **356.4 GWh**.
> - Peak generation reaches **10,690 MW at SP 28 (14:00 London time)**.
> - Crucially, look at the 48-period profile on the chart. The solid teal line is your latest forecast, but the shaded blue area is our **calibrated empirical P10 to P90 uncertainty envelope**.
> 
> Instead of giving a trader a single dangerous point forecast, we give them an empirical margin: **±2,145 MW at 90% confidence**.
> 
> Look at the final scorecard: **Estimated Imbalance Exposure: £4.17M**. This translates volumetric uncertainty directly into financial cashout risk so risk managers can price their risk premiums before gate closure. And with one click on **'Export CSV'**, the shift trader can pull all 48 half-hours into their proprietary dispatch model."*

---

### [02:15 - 03:45] 3 Concrete Insights from Real January 2026 Numbers
*(Screen share: Click 'Accuracy Analysis' tab or press keyboard shortcut `2`)*

> *"Now let's switch to the **Accuracy Analysis** across all 1,488 settlement periods in January 2026. Three numbers stand out that will immediately change how you trade:*
> 
> 1. **Insight 1: Systemic Over-Forecasting Bias (+1,851.9 MW)**
>    *Across January, national forecasts over-predicted actual wind generation in **86.3% of settlement periods** with an average bias of **+1.85 GW**. If your desk bought power 1-to-1 against the national forecast, you were persistently long into delivery and leaking cash on imbalance settlement.*
>    * **What to do:** Discount national forecast volumes by **12% to 15%** at D-1, or carry a short virtual position into the intraday market.
> 
> 2. **Insight 2: Severe Ramp Vulnerability (The January 28 Event)**
>    *Looking at our Daily MAE chart, **January 28 was our worst miss, with an MAE of 5,374.8 MW**. Numerical weather models forecasted a high-pressure Atlantic front that stalled over the North Sea. Actual wind generation lagged forecast by over 6,000 MW.*
>    * **What to do:** When meteorological models flag sharp frontal transitions, widen your physical backup margin to **3.5 GW** and hold prompt fast-response gas or battery options.
> 
> 3. **Insight 3: High Relative Risk in Low-Wind Regimes (NMAE 68.1%)**
>    *Looking at our Wind Level Breakdown: while High Wind days have the largest MW errors, **Low Wind days (<5 GW outturn) had a Normalized MAE of 68.1%**. In low-wind periods, percentage forecast volatility is highest.*
>    * **What to do:** Hold a tighter percentage buffer during low wind regimes where thermal baseload replacement is critical."*

---

### [03:45 - 04:45] Next Steps & Commercial Expansion
> *"What you’re seeing today is Phase 1: national wind generation evaluation. The natural commercial expansion roadmap includes:
> 1. **Integrating Half-Hourly System Cashout Prices (SSP/SBP)** from Elexon’s `SYSMSG` stream to move from volumetric MAE to true financial profit-and-loss loss functions.
> 2. **Adding National Solar and Demand Outturns** to evaluate net residual system demand.
> 3. **Connecting a Live Websocket Feed** to transition seamlessly from day-ahead auction planning to real-time intraday position balancing.
> 
> Thank you, and I look forward to your questions."*

---
---

## PART 2: Technical Deep-Dive & Senior Audit (Max 5 Minutes)
**Audience:** Lead Architect, Engineering Manager, Senior Staff Reviewers  
**Tone:** Precise, technical, architectural, honest about trade-offs  
**Target Duration:** ~4 minutes 50 seconds

---

### Screen-Share Order (Files to Open in IDE / Browser):
1. [README.md](file:///c:/Users/mdalt/OneDrive/Desktop/reint/README.md) (Architecture Mermaid Diagram)
2. [backend/app/services/analysis.py](file:///c:/Users/mdalt/OneDrive/Desktop/reint/backend/app/services/analysis.py#L20-L115) (Cutoff conversion & Pure Analysis functions)
3. [backend/app/services/data_manager.py](file:///c:/Users/mdalt/OneDrive/Desktop/reint/backend/app/services/data_manager.py) (Parquet caching singleton)
4. [backend/app/routers/api.py](file:///c:/Users/mdalt/OneDrive/Desktop/reint/backend/app/routers/api.py) (Pydantic validation & thin controllers)
5. [frontend/src/App.tsx](file:///c:/Users/mdalt/OneDrive/Desktop/reint/frontend/src/App.tsx) & [frontend/src/styles/tokens.css](file:///c:/Users/mdalt/OneDrive/Desktop/reint/frontend/src/styles/tokens.css) (Design tokens & hotkeys)
6. Terminal: Running `pytest` and `vitest`

---

### [05:00 - 06:00] Architecture & Data Flow
*(Screen share: `README.md` at Section 3 Mermaid diagram)*

> *"Hi everyone. Let’s dive into the technical implementation.
> 
> The system follows a clean, decoupled three-tier architecture:
> 1. **Data Ingestion (`backend/app/services/ingest.py`)**: Connects to live Elexon BMRS v1 stream endpoints (`/datasets/FUELHH` and `/datasets/WINDFOR`). We implement chunked date range batching (respecting Elexon's 31-day request ceiling), exponential backoff retry, and Pydantic schema validation.
> 2. **Storage Strategy**: Processed records are stored as Snappy-compressed Parquet files in `/data/processed/`. The entire month of January—1,536 actuals and 19,272 forecast rows—occupies **just 184 KB**.
> 3. **Backend Service Layer (`FastAPI`)**: A singleton `DataManager` loads the Parquet files once into memory on cold start in **<50ms**, eliminating database connection pools and keeping serverless memory footprint well within Vercel's limits.
> 4. **Frontend Layer (`React 19 + TypeScript + Vite`)**: A high-density trading UI using Tailwind v4 CSS variables, Recharts, and TanStack Query."*

---

### [06:00 - 07:15] Code Walkthrough: Cutoff Logic & Anti-Leakage
*(Screen share: `backend/app/services/analysis.py` lines 20-115)*

> *"The single most critical requirement in power market backtesting is **zero lookahead leakage**. Let’s look at lines 20 through 115 in `analysis.py`.
> 
> 1. **Timezone & DST Conversion (`convert_local_cutoff_to_utc`)**:
>    - Traders specify cutoff in local market time (e.g., `09:00 Europe/London` on day $D-1$).
>    - We use `pytz.timezone('Europe/London').localize(..., is_dst=None)` to handle clock changes (BST/GMT) explicitly, returning an absolute timezone-aware UTC datetime.
> 2. **Point-in-Time Forecast Selection (`get_decision_forecast`)**:
>    - We filter: `valid_forecasts = windfor_df[windfor_df['publishTime'] <= cutoff_utc]`.
>    - For each forecast target time, we pick the record with the latest publication timestamp.
>    - Because WINDFOR publishes on an hourly target cadence, we generate a complete 48 half-hour grid and map each half-hour target (e.g., 14:30) deterministically to its parent hour forecast (14:00).
> 3. **Anti-Leakage Empirical Uncertainty (`error_bands`)**:
>    - Look at line 355: When computing P10, P50, and P90 error bands for a target delivery date, **that delivery date's own outturns are explicitly excluded from the calibration set** (`target_start.dt.date != target_dt`).
>    - This ensures out-of-sample uncertainty estimation that mirrors real live trading."*

---

### [07:15 - 08:30] Metric Choices, Testing & Containerization
*(Screen share: Terminal running `python -m pytest backend/tests` and `cd frontend && npm test`)*

> *"Now let's talk about metrics and testing:
> 
> 1. **Statistical Metrics**:
>    - We compute **MAE** for linear volume imbalance and **RMSE** for quadratic volatility penalties.
>    - We report **Mean Bias** to isolate directional drift.
>    - For **MAPE**, periods with zero actual generation are suppressed to prevent division-by-zero distortion, and we report the exact suppression count.
> 2. **Testing Rigor**:
>    - Notice our test suite: **23 Pytest unit and integration tests** passing with **91% backend code coverage** and **zero Pandas warnings** (we added `include_groups=False` to all `.groupby().apply()` calls).
>    - We test DST transitions, offline mock ingestion via HTTPX transports, missing data handling, and input validation.
>    - On the frontend: **8 Vitest tests** covering formatting utilities, energy integration, and component rendering.
> 3. **Production Docker Stack**:
>    - **Backend Dockerfile**: Uses `python:3.11-slim`, runs as an unprivileged non-root user (`appuser`, UID 1001), and includes a container healthcheck against `/api/health`.
>    - **Frontend Dockerfile**: Multi-stage build (Node 22-alpine compiler $\rightarrow$ Nginx Alpine reverse proxy) with 1-year asset caching and SPA rewrites."*

---

### [08:30 - 09:30] Trade-Offs, Limitations & AI Tool Usage
*(Screen share: `README.md` Sections 9 and 11)*

> *"To wrap up, let's discuss trade-offs and AI tooling:
> 
> **Architectural Trade-Offs & Limitations:**
> 1. **Parquet vs Relational DB**: We chose Parquet because the dataset is read-heavy and static (Jan 2026). For a streaming multi-year production system, we would pair this with ClickHouse or TimescaleDB.
> 2. **Hourly vs Half-Hourly Forecast Resolution**: WINDFOR’s hourly resolution requires half-hour mapping. While interpolating is an option, mapping to parent hour preserves the exact published forecast figure.
> 3. **Symmetric vs Asymmetric Loss**: MAE treats over- and under-forecasting equally. In production, we would integrate Elexon System Buy/Sell Prices for asymmetric cashout loss.
> 
> **AI Tooling Disclosure:**
> - We used **Google Antigravity** as our agentic AI pair programming tool.
> - Antigravity assisted with OpenAPI schema inspection, initial endpoint scaffolding, and boilerplate refactoring.
> - As lead engineer, I verified and audited every formula, the anti-leakage leave-one-out uncertainty logic, timezone transitions, and wrote the test suites to guarantee correctness.
> 
> All code is clean, typed, documented, and ready for deployment. Thank you!"*
