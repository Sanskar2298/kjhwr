/**
 * Strongly typed HTTP API client for backend day-ahead energy trading service.
 * Never uses `any`. Strict error propagation and query param encoding.
 */

import {
  AccuracyMetricsSummary,
  ActualsResponse,
  DailyBreakdown,
  DecisionForecastResponse,
  ForecastEvolutionResponse,
  HorizonBucketBreakdown,
  HourOfDayBreakdown,
  MetaResponse,
  TimeseriesComparisonPoint,
  WindLevelBreakdown,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchJson<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url);
  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errObj = (await response.json()) as { detail?: string };
      if (errObj && errObj.detail) {
        errorDetail = errObj.detail;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(`API Error [${response.status}]: ${errorDetail}`);
  }
  return (await response.json()) as T;
}

export const apiClient = {
  getMeta: (): Promise<MetaResponse> => {
    return fetchJson<MetaResponse>('/api/meta');
  },

  getDecisionForecast: (deliveryDate: string, cutoffHour: string): Promise<DecisionForecastResponse> => {
    const params = new URLSearchParams({
      delivery_date: deliveryDate,
      cutoff_hour: cutoffHour,
    });
    return fetchJson<DecisionForecastResponse>(`/api/forecast/decision?${params.toString()}`);
  },

  getForecastEvolution: (targetUtcIso: string): Promise<ForecastEvolutionResponse> => {
    const params = new URLSearchParams({ target: targetUtcIso });
    return fetchJson<ForecastEvolutionResponse>(`/api/forecast/evolution?${params.toString()}`);
  },

  getActuals: (start: string, end: string): Promise<ActualsResponse> => {
    const params = new URLSearchParams({ start, end });
    return fetchJson<ActualsResponse>(`/api/actuals?${params.toString()}`);
  },

  getAccuracySummary: (
    start: string,
    end: string,
    cutoffHour: string
  ): Promise<AccuracyMetricsSummary> => {
    const params = new URLSearchParams({
      start,
      end,
      cutoff_hour: cutoffHour,
    });
    return fetchJson<AccuracyMetricsSummary>(`/api/accuracy/summary?${params.toString()}`);
  },

  getAccuracyByHorizon: (
    start: string,
    end: string,
    cutoffHour: string
  ): Promise<HorizonBucketBreakdown[]> => {
    const params = new URLSearchParams({ start, end, cutoff_hour: cutoffHour });
    return fetchJson<HorizonBucketBreakdown[]>(`/api/accuracy/by-horizon?${params.toString()}`);
  },

  getAccuracyByHour: (
    start: string,
    end: string,
    cutoffHour: string
  ): Promise<HourOfDayBreakdown[]> => {
    const params = new URLSearchParams({ start, end, cutoff_hour: cutoffHour });
    return fetchJson<HourOfDayBreakdown[]>(`/api/accuracy/by-hour?${params.toString()}`);
  },

  getAccuracyByWindLevel: (
    start: string,
    end: string,
    cutoffHour: string
  ): Promise<WindLevelBreakdown[]> => {
    const params = new URLSearchParams({ start, end, cutoff_hour: cutoffHour });
    return fetchJson<WindLevelBreakdown[]>(`/api/accuracy/by-wind-level?${params.toString()}`);
  },

  getAccuracyDaily: (
    start: string,
    end: string,
    cutoffHour: string
  ): Promise<DailyBreakdown[]> => {
    const params = new URLSearchParams({ start, end, cutoff_hour: cutoffHour });
    return fetchJson<DailyBreakdown[]>(`/api/accuracy/daily?${params.toString()}`);
  },

  getAccuracyTimeseries: (
    start: string,
    end: string,
    cutoffHour: string
  ): Promise<TimeseriesComparisonPoint[]> => {
    const params = new URLSearchParams({ start, end, cutoff_hour: cutoffHour });
    return fetchJson<TimeseriesComparisonPoint[]>(`/api/accuracy/timeseries?${params.toString()}`);
  },
};
