/**
 * TypeScript interfaces matching FastAPI backend schemas exactly.
 * Strict typing with no `any`.
 */

export interface MetaResponse {
  min_delivery_date: string; // YYYY-MM-DD
  max_delivery_date: string; // YYYY-MM-DD
  default_delivery_date: string;
  default_cutoff_hour: string; // e.g. "09:00"
  timezone: string; // "Europe/London"
  total_periods_available: number;
}

export interface DecisionForecastPoint {
  target_start: string; // ISO 8601 UTC
  settlement_period: number; // 1-50
  forecast_mw: number | null;
  publish_time: string | null;
  horizon_hours: number | null;
  band_p10_mw: number | null;
  band_p50_mw: number | null;
  band_p90_mw: number | null;
}

export interface DecisionForecastResponse {
  delivery_date: string;
  cutoff_hour: string;
  cutoff_utc: string;
  points: DecisionForecastPoint[];
}

export interface ForecastEvolutionPoint {
  publish_time: string;
  start_time: string;
  generation_mw: number;
  horizon_hours: number;
}

export interface ForecastEvolutionResponse {
  target_start: string;
  revisions: ForecastEvolutionPoint[];
}

export interface ActualPoint {
  start_time: string;
  settlement_date: string;
  settlement_period: number;
  fuel_type: string;
  actual_mw: number;
}

export interface ActualsResponse {
  count: number;
  actuals: ActualPoint[];
}

export interface AccuracyMetricsSummary {
  start_date: string;
  end_date: string;
  cutoff_hour: string;
  n_intervals: number;
  n_zero_actuals_suppressed: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
  median_ae_mw: number;
  p90_ae_mw: number;
  p95_ae_mw: number;
  nmae_pct: number;
  mape_pct: number | null;
  r2: number;
}

export interface HorizonBucketBreakdown {
  horizon_bucket: string;
  count: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
}

export interface HourOfDayBreakdown {
  hour: number;
  count: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
  mean_actual_mw: number;
  mean_forecast_mw: number;
}

export interface WindLevelBreakdown {
  wind_level: string;
  count: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
  nmae_pct: number;
}

export interface DailyBreakdown {
  date: string; // serialized alias from delivery_date
  count: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
  mean_actual_mw: number;
  mean_forecast_mw: number;
}

export interface TimeseriesComparisonPoint {
  target_start: string;
  settlement_period: number;
  actual_mw: number | null;
  forecast_mw: number | null;
  error_mw: number | null; // Forecast - Actual
  abs_error_mw: number | null;
  horizon_hours: number | null;
}
