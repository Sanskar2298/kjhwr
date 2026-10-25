import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Zap,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { DecisionChart } from './DecisionChart';
import { KpiCard } from '../common/KpiCard';
import {
  formatMW,
  formatLondonDateTime,
  formatLondonTime,
  calculateTotalEnergyMWh,
  formatGWh,
} from '../../utils/formatters';

interface DecisionViewProps {
  deliveryDate: string;
  setDeliveryDate: (d: string) => void;
  cutoffHour: string;
  setCutoffHour: (c: string) => void;
}

export const DecisionView: React.FC<DecisionViewProps> = ({
  deliveryDate,
  setDeliveryDate,
  cutoffHour,
  setCutoffHour,
}) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['decisionForecast', deliveryDate, cutoffHour],
    queryFn: () => apiClient.getDecisionForecast(deliveryDate, cutoffHour),
    staleTime: 60 * 1000,
  });

  // Calculate day-ahead summary statistics from 48 periods
  const stats = useMemo(() => {
    if (!data || !data.points || data.points.length === 0) return null;

    const validPoints = data.points.filter((p) => p.forecast_mw !== null);
    const forecastVals = validPoints.map((p) => p.forecast_mw as number);

    if (forecastVals.length === 0) return null;

    const minMw = Math.min(...forecastVals);
    const maxMw = Math.max(...forecastVals);
    const avgMw = forecastVals.reduce((a, b) => a + b, 0) / forecastVals.length;
    const totalEnergyMwh = calculateTotalEnergyMWh(forecastVals);

    // Publication time span
    const pubTimes = validPoints
      .map((p) => (p.publish_time ? new Date(p.publish_time).getTime() : 0))
      .filter((t) => t > 0);
    const minPubTime = pubTimes.length > 0 ? new Date(Math.min(...pubTimes)).toISOString() : null;
    const maxPubTime = pubTimes.length > 0 ? new Date(Math.max(...pubTimes)).toISOString() : null;

    // Typical error range at P90 for this horizon
    const errorP90s = validPoints
      .map((p) => (p.band_p90_mw !== null && p.forecast_mw !== null ? p.band_p90_mw - p.forecast_mw : null))
      .filter((val): val is number => val !== null);
    const avgErrorP90 = errorP90s.length > 0 ? errorP90s.reduce((a, b) => a + b, 0) / errorP90s.length : 2150;

    return {
      minMw,
      maxMw,
      avgMw,
      totalEnergyMwh,
      minPubTime,
      maxPubTime,
      avgErrorP90,
      totalPeriods: data.points.length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <label htmlFor="delivery-date" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Delivery Day:
            </label>
            <input
              id="delivery-date"
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <label htmlFor="cutoff-selector" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              D-1 Gate Cutoff:
            </label>
            <select
              id="cutoff-selector"
              value={cutoffHour}
              onChange={(e) => setCutoffHour(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="09:00">09:00 London (Pre-Gate Morning)</option>
              <option value="11:00">11:00 London (EPEX SPOT Gate)</option>
              <option value="12:00">12:00 London (Nord Pool Gate)</option>
              <option value="16:00">16:00 London (Afternoon Re-balance)</option>
            </select>
          </div>
        </div>

        {/* Publication banner card */}
        {stats && (
          <div className="text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Forecasts published between{' '}
              <strong className="text-slate-200 font-mono">
                {formatLondonTime(stats.minPubTime)}
              </strong>{' '}
              and{' '}
              <strong className="text-slate-200 font-mono">
                {formatLondonTime(stats.maxPubTime)}
              </strong>{' '}
              on D-1
            </span>
          </div>
        )}
      </div>

      {/* Loading & error states */}
      {isLoading && (
        <div className="glass-panel p-12 rounded-xl text-center text-slate-400 animate-pulse">
          Loading day-ahead decision forecast...
        </div>
      )}

      {isError && (
        <div className="glass-panel p-6 rounded-xl border border-rose-500/40 text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{(error as Error)?.message || 'Failed to load forecast for selected date'}</span>
        </div>
      )}

      {data && stats && (
        <>
          {/* Key Metric Scorecards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Expected Wind Energy"
              value={formatGWh(stats.totalEnergyMwh)}
              subtitle={`${stats.totalEnergyMwh.toLocaleString('en-GB', { maximumFractionDigits: 0 })} MWh`}
              explanation="Total projected wind electricity generation for delivery across all 48 settlement periods."
              formula="Σ (Forecast MW * 0.5 hours)"
            />

            <KpiCard
              label="Peak Generation"
              value={formatMW(stats.maxMw)}
              subtitle="Max settlement period output"
              explanation="Highest single half-hour generation expected during the delivery day."
              status="positive"
            />

            <KpiCard
              label="Minimum Generation"
              value={formatMW(stats.minMw)}
              subtitle="Trough settlement period"
              explanation="Lowest expected half-hour generation during the delivery day (indicates baseline thermal backup required)."
            />

            <KpiCard
              label="Typical Lead Error"
              value={`±${Math.round(stats.avgErrorP90)} MW`}
              unit="at P90"
              subtitle="Empirical 90% confidence range"
              explanation="Historical 90th percentile error margin calibrated for this lead time horizon, excluding the target day."
              formula="Quantile(Actual - Forecast, 0.90)"
              status="warning"
            />
          </div>

          {/* 48-point Chart & Trading Guidance Panel */}
          <div className="glass-panel p-5 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-800/80 gap-2">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  Day-Ahead Wind Generation Profile ({deliveryDate})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  48 half-hourly settlement periods at {cutoffHour} D-1 decision gate with historical P10–P90 uncertainty envelope
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Latest Forecast
                </span>
                <span className="flex items-center gap-1.5 text-sky-300">
                  <span className="w-3 h-2 bg-sky-500/20 border border-sky-400 border-dashed inline-block" /> P10–P90 Uncertainty
                </span>
              </div>
            </div>

            <DecisionChart points={data.points} />
          </div>
        </>
      )}
    </div>
  );
};
