# Wind Generation Forecast & Accuracy Analysis Notes

## 1. Domain Context: UK Day-Ahead Power Trading

In the GB wholesale power market, utilities trade standard blocks and hourly/half-hourly contracts on day-ahead power exchanges (e.g. EPEX SPOT, Nord Pool).
Key operational parameters:
- **Decision Horizon (D-1)**: Day-ahead auction gate closure occurs around midday (e.g., 11:00 or 12:00 GMT/BST) on day D-1 for physical delivery throughout day D (00:00 to 24:00 clock time, 48 settlement periods).
- **Physical Delivery**: Half-hourly settlement periods (SP 1 to 48).
- **BMRS Data Sets**:
  - `WINDFOR`: National wind generation forecasts published at regular cadences by ESO. Crucially includes `publishTime` and `startTime`.
  - `FUELHH`: Outturn half-hourly actuals by fuel category. We isolate `fuelType == 'WIND'` and field `generation` (MW).

## 2. Decision Time Forecast Selection Rule

For a target delivery period starting at `startTime` on day `D`:
- Day-ahead decision occurs on day `D-1` at cutoff time `T_decision` (e.g., 12:00 London time).
- To avoid lookahead bias and data leakage, the wind forecast must be the **latest forecast record with `publishTime <= T_decision (D-1)` for the target `startTime`**.
- Any forecast published after `T_decision` was physically unavailable to the trader during order submission.

## 3. Quantitative Accuracy Metrics

We evaluate the selected day-ahead forecast $F_t$ against outturn actual $A_t$ for each settlement period $t$:
1. **Error**: $e_t = F_t - A_t$ (Positive indicates over-forecast; negative indicates under-forecast)
2. **Mean Absolute Error (MAE)**:
   $$\text{MAE} = \frac{1}{N} \sum_{t=1}^N |F_t - A_t|$$
3. **Root Mean Square Error (RMSE)**:
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{t=1}^N (F_t - A_t)^2}$$
4. **Mean Bias Error (MBE)**:
   $$\text{MBE} = \frac{1}{N} \sum_{t=1}^N (F_t - A_t)$$
5. **Mean Absolute Percentage Error (MAPE)** / Normalized MAE (NMAE):
   - Capacity-normalized NMAE: $\frac{\text{MAE}}{\text{Installed Capacity or Peak Outturn}} \times 100\%$ (standard in wind analytics to prevent zero-division).
6. **Peak/Ramp Errors**: Analysis of peak wind deviations and sudden ramp-up/ramp-down misses.
