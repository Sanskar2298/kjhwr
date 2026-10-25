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
import { AlertCircle, TrendingDown, Target, BarChart2, Activity } from 'lucide-react';
import { apiClient } from '../../api/client';
import { KpiCard } from '../common/KpiCard';
import { formatMW, formatPct, formatLondonTime } from '../../utils/formatters';

interface AccuracyViewProps {
  cutoffHour: string;
}

export const AccuracyView: React.FC<AccuracyViewProps> = ({ cutoffHour }) => {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');

  // Summary KPIs query
  const summaryQuery = useQuery({
    queryKey: ['accuracySummary', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracySummary(startDate, endDate, cutoffHour),
  });

  // Timeseries comparison query
  const timeseriesQuery = useQuery({
    queryKey: ['accuracyTimeseries', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyTimeseries(startDate, endDate, cutoffHour),
  });

  // Horizon breakdown query
  const horizonQuery = useQuery({
    queryKey: ['accuracyHorizon', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyByHorizon(startDate, endDate, cutoffHour),
  });

  // Hour of day breakdown query
  const hourQuery = useQuery({
    queryKey: ['accuracyHour', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyByHour(startDate, endDate, cutoffHour),
  });

  // Wind level breakdown query
  const windLevelQuery = useQuery({
    queryKey: ['accuracyWindLevel', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyByWindLevel(startDate, endDate, cutoffHour),
  });

  // Daily breakdown query
  const dailyQuery = useQuery({
    queryKey: ['accuracyDaily', startDate, endDate, cutoffHour],
    queryFn: () => apiClient.getAccuracyDaily(startDate, endDate, cutoffHour),
  });

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      {/* Date range filter banner */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Evaluation Range:
            </span>
            <input
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <span className="text-slate-500 text-sm">to</span>
            <input
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
            Decision Gate: <strong className="text-cyan-400 font-mono">{cutoffHour} D-1</strong>
          </div>
        </div>

        {summary && (
          <div className="text-xs text-slate-400 font-mono">
            {summary.n_intervals} settlement periods evaluated
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            subtitle={summary.mean_bias_mw > 0 ? 'Over-forecasting' : 'Under-forecasting'}
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
      )}

      {/* Actual vs Forecast Full Time Series */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800">
        <h3 className="text-base font-semibold text-white tracking-tight mb-1 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Actual Outturn vs Day-Ahead Decision Forecast
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Continuous half-hourly national generation compared against D-1 {cutoffHour} forecast
        </p>

        {timeseriesQuery.isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-500">Loading timeseries...</div>
        ) : timeseriesQuery.data ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={timeseriesQuery.data.slice(0, 336)} // sample first ~7 days if large for performance
                margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="target_start"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => val.slice(5, 10)}
                  interval={48}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}GW`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="glass-panel-elevated p-2.5 rounded-lg border border-slate-700 text-xs shadow-xl text-slate-200">
                          <div className="font-semibold text-cyan-400 mb-1">{d.target_start.slice(0, 16).replace('T', ' ')} UTC</div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Actual:</span>
                            <span className="font-mono font-bold text-emerald-400">{formatMW(d.actual_mw)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Forecast:</span>
                            <span className="font-mono font-bold text-cyan-400">{formatMW(d.forecast_mw)}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                            <span className="text-slate-400">Imbalance (Error):</span>
                            <span className="font-mono font-bold text-amber-400">{formatMW(d.error_mw)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="actual_mw"
                  name="Actual Outturn (FUELHH)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast_mw"
                  name={`Decision Forecast (${cutoffHour})`}
                  stroke="#06b6d4"
                  strokeWidth={1.8}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      {/* Grid of Error Breakdowns: Horizon, Hour of Day, Wind Level, Daily */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Lead Horizon */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <h4 className="text-sm font-semibold text-white tracking-tight mb-1 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            Error by Forecast Lead Horizon
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            How forecast error (MAE and Mean Bias) scales as lead time increases ahead of delivery
          </p>
          {horizonQuery.data && (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horizonQuery.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="horizon_bucket" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}MW`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="glass-panel-elevated p-2.5 rounded-lg border border-slate-700 text-xs text-slate-200">
                            <div className="font-semibold text-amber-400">{d.horizon_bucket} lead</div>
                            <div>MAE: <span className="font-mono text-white font-bold">{formatMW(d.mae_mw)}</span></div>
                            <div>Bias: <span className="font-mono text-cyan-300">{formatMW(d.mean_bias_mw)}</span></div>
                            <div className="text-[10px] text-slate-400 mt-1">{d.count} periods</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="mae_mw" name="MAE (MW)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="mean_bias_mw" name="Bias (MW)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Breakdown by Hour of Day */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <h4 className="text-sm font-semibold text-white tracking-tight mb-1 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            Error by Clock Hour of Day
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Diurnal distribution of forecast error (0–23 UTC) across the delivery day
          </p>
          {hourQuery.data && (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourQuery.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(h) => `${h}h`} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}MW`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="glass-panel-elevated p-2.5 rounded-lg border border-slate-700 text-xs text-slate-200">
                            <div className="font-semibold text-emerald-400">Hour {d.hour}:00 UTC</div>
                            <div>MAE: <span className="font-mono text-white font-bold">{formatMW(d.mae_mw)}</span></div>
                            <div>Bias: <span className="font-mono text-cyan-300">{formatMW(d.mean_bias_mw)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="mae_mw" name="MAE (MW)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Breakdown by Wind Generation Regime */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <h4 className="text-sm font-semibold text-white tracking-tight mb-1 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            Accuracy by Wind Generation Regime
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Low (&lt;5 GW), Medium (5–12 GW), and High (&gt;12 GW) wind outturn
          </p>
          {windLevelQuery.data && (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={windLevelQuery.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="wind_level" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}MW`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="glass-panel-elevated p-2.5 rounded-lg border border-slate-700 text-xs text-slate-200">
                            <div className="font-semibold text-rose-400">{d.wind_level} Regime</div>
                            <div>MAE: <span className="font-mono text-white font-bold">{formatMW(d.mae_mw)}</span></div>
                            <div>Normalized MAE: <span className="font-mono text-amber-300">{formatPct(d.nmae_pct)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="mae_mw" name="MAE (MW)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Daily Error Bar Chart / Heatmap */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <h4 className="text-sm font-semibold text-white tracking-tight mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Daily MAE (January 2026)
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Day-by-day average absolute error highlighting volatile ramp events
          </p>
          {dailyQuery.data && (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyQuery.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => d.slice(8, 10)} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}MW`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="glass-panel-elevated p-2.5 rounded-lg border border-slate-700 text-xs text-slate-200">
                            <div className="font-semibold text-purple-400">{d.date}</div>
                            <div>Daily MAE: <span className="font-mono text-white font-bold">{formatMW(d.mae_mw)}</span></div>
                            <div>Mean Actual: <span className="font-mono text-emerald-300">{formatMW(d.mean_actual_mw)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mae_mw" name="Daily MAE" radius={[3, 3, 0, 0]}>
                    {dailyQuery.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.mae_mw > 4000 ? '#f43f5e' : entry.mae_mw > 2500 ? '#f59e0b' : '#8b5cf6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
