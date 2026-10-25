import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';
import { apiClient } from '../../api/client';
import { KpiCard } from '../common/KpiCard';
import { formatMW, formatPct } from '../../utils/formatters';

interface AccuracyViewProps {
  cutoffHour: string;
}

export const AccuracyView: React.FC<AccuracyViewProps> = ({ cutoffHour }) => {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');

  const summaryQuery = useQuery({
    queryKey: ['accuracySummary', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracySummary(startDate, endDate, cutoffHour),
  });

  const timeseriesQuery = useQuery({
    queryKey: ['accuracyTimeseries', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyTimeseries(startDate, endDate, cutoffHour),
  });

  const horizonQuery = useQuery({
    queryKey: ['accuracyHorizon', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyByHorizon(startDate, endDate, cutoffHour),
  });

  const hourQuery = useQuery({
    queryKey: ['accuracyHour', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyByHour(startDate, endDate, cutoffHour),
  });

  const windLevelQuery = useQuery({
    queryKey: ['accuracyWindLevel', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyByWindLevel(startDate, endDate, cutoffHour),
  });

  const dailyQuery = useQuery({
    queryKey: ['accuracyDaily', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyDaily(startDate, endDate, cutoffHour),
  });

  const summary = summaryQuery.data;

  return (
    <div className="space-y-4">
      {/* Sticky Range Filter Bar */}
      <div className="panel p-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Evaluation Range:
            </span>
            <input
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-[4px] px-2.5 py-1 text-[13px] tabular-nums focus:outline-none focus:border-[var(--color-forecast)]"
            />
            <span className="text-[var(--text-muted)]">to</span>
            <input
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-[4px] px-2.5 py-1 text-[13px] tabular-nums focus:outline-none focus:border-[var(--color-forecast)]"
            />
          </div>

          <div className="text-[12px] text-[var(--text-secondary)]">
            Gate: <strong className="text-[var(--color-forecast)] font-mono">{cutoffHour} D-1</strong>
          </div>
        </div>

        {summary && (
          <div className="text-[12px] text-[var(--text-secondary)] tabular-nums">
            {summary.n_intervals} settlement periods evaluated
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="MAE"
            value={formatMW(summary.mae_mw)}
            subtitle="Mean Absolute Error"
            explanation="Average magnitude of forecast error across all evaluated periods. Linear metric for volume imbalance."
            formula="mean(|forecast - actual|)"
          />

          <KpiCard
            label="RMSE"
            value={formatMW(summary.rmse_mw)}
            subtitle="Root Mean Square Error"
            explanation="Square root of average squared errors. Heavily penalizes large misses."
            formula="sqrt(mean((forecast - actual)^2))"
          />

          <KpiCard
            label="Mean Bias"
            value={`${summary.mean_bias_mw > 0 ? '+' : ''}${formatMW(summary.mean_bias_mw)}`}
            subtitle={summary.mean_bias_mw > 0 ? 'Over-forecasting (Long)' : 'Under-forecasting (Short)'}
            explanation="Signed average error. Positive indicates national forecasts consistently over-estimated generation."
            formula="mean(forecast - actual)"
            status={summary.mean_bias_mw > 0 ? 'warning' : 'neutral'}
          />

          <KpiCard
            label="P90 Abs Error"
            value={formatMW(summary.p90_ae_mw)}
            subtitle="90th percentile miss"
            explanation="90% of periods had an absolute forecast error less than or equal to this value. Tail risk indicator."
            formula="Quantile(|forecast - actual|, 0.90)"
          />

          <KpiCard
            label="Normalized MAE"
            value={formatPct(summary.nmae_pct)}
            subtitle={`R² = ${summary.r2.toFixed(3)}`}
            explanation="MAE divided by mean actual generation, representing the relative forecast accuracy."
            formula="(MAE / Mean Actual) * 100%"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="panel p-3.5 h-20 skeleton" />
          ))}
        </div>
      )}

      {/* Actual vs Forecast Full Time Series */}
      <div className="panel p-4">
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Actual Outturn vs Day-Ahead Decision Forecast
            </h3>
            <div className="text-[12px] text-[var(--text-secondary)]">
              Half-hourly national generation compared against D-1 {cutoffHour} forecast
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] tabular-nums">
            <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
              <span className="w-3 h-0.5 bg-[var(--color-actual)] inline-block" /> Actual Outturn
            </span>
            <span className="flex items-center gap-1.5 text-[var(--color-forecast)]">
              <span className="w-3 h-0.5 bg-[var(--color-forecast)] inline-block" /> Decision Forecast
            </span>
          </div>
        </div>

        {timeseriesQuery.data ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={timeseriesQuery.data.slice(0, 336)}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="target_start"
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickFormatter={(val) => val.slice(5, 10)}
                  interval={48}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}GW`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="panel-elevated p-2 text-[12px] text-[var(--text-primary)]">
                          <div className="font-semibold text-[var(--color-forecast)] mb-1 tabular-nums">
                            {d.target_start.slice(0, 16).replace('T', ' ')} UTC
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[var(--text-secondary)]">Actual Outturn:</span>
                            <span className="tabular-nums font-semibold text-[var(--text-primary)]">{formatMW(d.actual_mw)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[var(--text-secondary)]">Forecast:</span>
                            <span className="tabular-nums font-semibold text-[var(--color-forecast)]">{formatMW(d.forecast_mw)}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t border-[var(--border-subtle)]">
                            <span className="text-[var(--text-secondary)]">Imbalance:</span>
                            <span className="tabular-nums text-[var(--color-over-forecast)]">{formatMW(d.error_mw)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="actual_mw"
                  name="Actual Outturn"
                  stroke="var(--color-actual)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast_mw"
                  name="Decision Forecast"
                  stroke="var(--color-forecast)"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 skeleton" />
        )}
      </div>

      {/* Grid of Error Breakdowns: Horizon, Hour of Day, Wind Level, Daily */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Breakdown by Lead Horizon */}
        <div className="panel p-4">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">
            Error by Forecast Lead Horizon
          </h4>
          <div className="text-[12px] text-[var(--text-secondary)] mb-3">
            Error (MAE &amp; Mean Bias) scaling as lead time increases ahead of delivery
          </div>
          {horizonQuery.data ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horizonQuery.data} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="horizon_bucket" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickFormatter={(v) => `${v}MW`} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="panel-elevated p-2 text-[12px] text-[var(--text-primary)]">
                            <div className="font-semibold text-[var(--color-forecast)] mb-1">{d.horizon_bucket} lead</div>
                            <div>MAE: <span className="tabular-nums font-semibold">{formatMW(d.mae_mw)}</span></div>
                            <div>Bias: <span className="tabular-nums text-[var(--color-over-forecast)]">{formatMW(d.mean_bias_mw)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mae_mw" name="MAE" fill="var(--color-forecast)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="mean_bias_mw" name="Bias" fill="var(--color-over-forecast)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 skeleton" />
          )}
        </div>

        {/* Breakdown by Hour of Day */}
        <div className="panel p-4">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">
            Error by Clock Hour of Day
          </h4>
          <div className="text-[12px] text-[var(--text-secondary)] mb-3">
            Diurnal distribution of forecast error (0–23 UTC) across the delivery day
          </div>
          {hourQuery.data ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourQuery.data} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickFormatter={(h) => `${h}h`} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickFormatter={(v) => `${v}MW`} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="panel-elevated p-2 text-[12px] text-[var(--text-primary)]">
                            <div className="font-semibold text-[var(--color-forecast)] mb-1">Hour {d.hour}:00 UTC</div>
                            <div>MAE: <span className="tabular-nums font-semibold">{formatMW(d.mae_mw)}</span></div>
                            <div>Mean Bias: <span className="tabular-nums text-[var(--color-over-forecast)]">{formatMW(d.mean_bias_mw)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mae_mw" name="MAE" fill="var(--color-forecast)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 skeleton" />
          )}
        </div>

        {/* Breakdown by Wind Generation Regime */}
        <div className="panel p-4">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">
            Accuracy by Wind Generation Regime
          </h4>
          <div className="text-[12px] text-[var(--text-secondary)] mb-3">
            Performance in Low (&lt;5 GW), Medium (5–12 GW), and High (&gt;12 GW) generation outturn
          </div>
          {windLevelQuery.data ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={windLevelQuery.data} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="wind_level" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickFormatter={(v) => `${v}MW`} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="panel-elevated p-2 text-[12px] text-[var(--text-primary)]">
                            <div className="font-semibold text-[var(--color-forecast)] mb-1">{d.wind_level} Regime</div>
                            <div>MAE: <span className="tabular-nums font-semibold">{formatMW(d.mae_mw)}</span></div>
                            <div>Normalized MAE: <span className="tabular-nums text-[var(--color-over-forecast)]">{formatPct(d.nmae_pct)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mae_mw" name="MAE" fill="var(--color-forecast)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 skeleton" />
          )}
        </div>

        {/* Daily Error Bars */}
        <div className="panel p-4">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-0.5">
            Daily MAE (January 2026)
          </h4>
          <div className="text-[12px] text-[var(--text-secondary)] mb-3">
            Day-by-day average absolute error highlighting volatile ramp events
          </div>
          {dailyQuery.data ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyQuery.data} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={(d) => d.slice(8, 10)} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickFormatter={(v) => `${v}MW`} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="panel-elevated p-2 text-[12px] text-[var(--text-primary)]">
                            <div className="font-semibold text-[var(--color-forecast)] mb-1">{d.date}</div>
                            <div>Daily MAE: <span className="tabular-nums font-semibold">{formatMW(d.mae_mw)}</span></div>
                            <div>Mean Actual: <span className="tabular-nums text-[var(--text-secondary)]">{formatMW(d.mean_actual_mw)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mae_mw" name="Daily MAE" radius={[2, 2, 0, 0]}>
                    {dailyQuery.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.mae_mw > 4000 ? 'var(--color-danger)' : entry.mae_mw > 2500 ? 'var(--color-over-forecast)' : 'var(--color-forecast)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 skeleton" />
          )}
        </div>
      </div>
    </div>
  );
};
