# Elexon BMRS API Technical Investigation Notes

**Author:** Senior Full-Stack Engineer  
**Date:** October 2026  
**Target Scope:** January 2026 Day-Ahead Wind Generation Decisions  
**API Documentation Source:** Live OpenAPI Specification verified at `https://data.elexon.co.uk/swagger/v1/swagger.json` (OpenAPI 3.0.4)

---

## 1. Specification & Endpoints Comparison

The Elexon Insights Solution provides two flavors of dataset endpoints:
1. **Metadata Dataset Endpoints** (`/datasets/FUELHH`, `/datasets/WINDFOR`): Returns payloads wrapped in `{"data": [...]}` with response format parameters (`json`, `xml`, `csv`).
2. **Optimized Stream Endpoints** (`/datasets/FUELHH/stream`, `/datasets/WINDFOR/stream`): Designed specifically for high-frequency/bulk pipelines. Emits flat JSON arrays (`[...]`) without envelope overhead, reducing payload footprint by ~20%.

### A. FUELHH (`/datasets/FUELHH/stream`)
* **Endpoint Summary:** Half-hourly generation outturn by fuel type.
* **Granularity:** 30-minute intervals (48 settlement periods per standard day).
* **Exact Query Parameters:**
  - `publishDateTimeFrom` (ISO-8601 date-time, UTC)
  - `publishDateTimeTo` (ISO-8601 date-time, UTC)
  - `settlementDateFrom` (string, `yyyy-MM-dd`)
  - `settlementDateTo` (string, `yyyy-MM-dd`)
  - `settlementPeriod` (array of integers `[1..48/50]`)
  - `fuelType` (array/string, e.g. `WIND`, `NUCLEAR`, `CCGT`)
* **Constraints from OpenAPI & Live Probing:**
  - Mutual Exclusivity: `settlementDate` parameters cannot be combined with `publishDateTime` parameters.
  - Range Limits: Max date span per request is **31 days** (day span $\le 31$). A query covering 32 days returns `HTTP 400 Bad Request`.
  - Server-Side Filtering: `fuelType=WIND` **is fully supported server-side**, avoiding the need to download irrelevant fuel categories (e.g. CCGT, Biomass, Nuclear).

### B. WINDFOR (`/datasets/WINDFOR/stream`)
* **Endpoint Summary:** National wind generation forecasts published by the National Energy System Operator (NESO).
* **Granularity:** Forecast generation values in MW issued at 60-minute time intervals across a ~72-hour forward horizon.
* **Exact Query Parameters:**
  - `publishDateTimeFrom` (ISO-8601 date-time, UTC)
  - `publishDateTimeTo` (ISO-8601 date-time, UTC)
* **Constraints from OpenAPI & Live Probing:**
  - Range Limits: Maximum range is **31 days** per request. Requesting $\ge 32$ days returns `HTTP 400 Bad Request`.
  - Default Behavior: If no publish time filters are provided, the API retrieves only the single latest published forecast. To evaluate historical day-ahead decisions made across January 2026, `publishDateTimeFrom` and `publishDateTimeTo` **must** be supplied.

---

## 2. Field Names, Types & Timezones (Empirical Verification)

Data retrieved and inspected for 2026-01-01 to 2026-01-04:

### FUELHH Sample Record
```json
{
  "dataset": "FUELHH",
  "publishTime": "2026-01-04T00:00:00Z",
  "startTime": "2026-01-03T23:30:00Z",
  "settlementDate": "2026-01-03",
  "settlementPeriod": 48,
  "fuelType": "WIND",
  "generation": 15291
}
```
* **Fields & Types:**
  - `dataset`: `str`
  - `publishTime`: `str` (ISO-8601 UTC with trailing `Z`)
  - `startTime`: `str` (ISO-8601 UTC with trailing `Z`)
  - `settlementDate`: `str` (`YYYY-MM-DD`, corresponds to the GB settlement calendar date)
  - `settlementPeriod`: `int` (1 to 48, or 50 on clock-change days)
  - `fuelType`: `str` (strictly `WIND` when filtered)
  - `generation`: `int` (instantaneous average power output in MW over the 30-min window)

### WINDFOR Sample Record
```json
{
  "dataset": "WINDFOR",
  "publishTime": "2026-01-03T22:30:00Z",
  "startTime": "2026-01-02T21:00:00Z",
  "generation": 16423
}
```
* **Fields & Types:**
  - `dataset`: `str`
  - `publishTime`: `str` (ISO-8601 UTC with trailing `Z`)
  - `startTime`: `str` (ISO-8601 UTC with trailing `Z`)
  - `generation`: `int` (Forecast power output in MW)
* **Timezone Rules:** Both `startTime` and `publishTime` are strictly returned with the `Z` suffix denoting UTC (`tzutc()`). No timezone translation or offset parsing is needed from the server.

---

## 3. Data Profile & Ingestion Characteristics

1. **Forecast Horizon & Lead Time:**
   - In each publication batch, NESO outputs a 73-point forecast array spanning from $T - 25.5\text{ hours}$ (retrospective outturns/backcasts) up to $T + 66.5\text{ hours}$ ahead.
   - Lead time categories observed:
     - Negative horizons ($< 0\text{h}$): Retrospective calibration points (approx. 20% of records).
     - Intraday ($0\text{h}$ to $24\text{h}$): Short-term updates.
     - **Day-Ahead Window ($24\text{h}$ to $48\text{h}$):** Matches decisions taken on D-1 for delivery on day D.
     - Two-day+ ahead ($> 48\text{h}$): Medium-range forecasts.
2. **Publish Frequency:**
   - Typically published every **2 to 4 hours** (e.g. 02:30, 04:30, 07:30, 09:30, 11:30, 15:30 UTC).
   - Each target delivery period has between **8 and 24 successive forecast revisions** published over time (average: 14.5 forecasts per target hour).
3. **Target Delivery Time Resolution (WINDFOR vs FUELHH):**
   - `FUELHH` actuals are published every **30 minutes** (48 periods/day).
   - `WINDFOR` forecasts in BMRS are published on an **hourly cadence (60 minutes)**.
   - *Alignment Strategy:* For half-hourly settlement periods that fall between hourly forecast timestamps (e.g., target 12:30), the standard power industry alignment maps the prevailing hourly forecast or performs linear interpolation.
4. **Data Integrity & Anomalies:**
   - Missing Periods: None observed in test window (exactly 48 settlement periods per day for Jan 1-3).
   - Duplicates: Zero duplicate `(startTime, publishTime)` tuples in raw data.
   - Nulls: Zero null values across all observed numeric and timestamp fields.
   - Server-Side Filtering: Tested and confirmed server-side filtering on `fuelType=WIND`.

---

## 4. Ingestion Date Boundaries for January 2026 Scope

To properly evaluate all day-ahead decisions made in **January 2026**:
* **Decision Dates:** 2026-01-01 through 2026-01-31.
* **Delivery Dates:**
  - Decision made on 2026-01-01 at 12:00 evaluates delivery on 2026-01-02.
  - Decision made on 2026-01-31 at 12:00 evaluates delivery on 2026-02-01.
  - Delivery on 2026-01-01 was decided on **2025-12-31 at 12:00**.
* **Required Ingestion Window:**
  - **WINDFOR `publishDateTime`:** `2025-12-30T00:00:00Z` to `2026-01-31T23:59:59Z`.
  - **FUELHH `settlementDate`:** `2026-01-01` to `2026-02-01`.
* **Chunking Strategy:**
  - To strictly adhere to the 31-day limit per request and guard against timeout/network drops, the pipeline chunks both datasets into **7-day or 14-day requests**.
