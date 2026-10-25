import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { DecisionChart } from './DecisionChart';
import { KpiCard } from '../common/KpiCard';
import {
  formatMW,
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

  const hourQuery = useQuery({
    queryKey: ['accuracyHour', '2026-01-01', '2026-01-31', cutoffHour],
    queryFn: () => apiClient.getAccuracyByHour('2026-01-01', '2026-01-31', cutoffHour),
  });

  // Calculate day-ahead summary statistics from API response
  const stats = useMemo(() => {
    if (!data || !data.points || data.points.length === 0) return null;

    const validPoints = data.points.filter((p) => p.forecast_mw !== null);
    const forecastVals = validPoints.map((p) => p.forecast_mw as number);

    if (forecastVals.length === 0) return null;

    // Peak & Trough with SP and start time
    let maxPt = validPoints[0];
    let minPt = validPoints[0];
    for (const p of validPoints) {
      if ((p.forecast_mw ?? 0) > (maxPt.forecast_mw ?? 0)) maxPt = p;
      if ((p.forecast_mw ?? 0) < (minPt.forecast_mw ?? 0)) minPt = p;
    }

    const minMw = minPt.forecast_mw as number;
    const maxMw = maxPt.forecast_mw as number;
    const avgMw = forecastVals.reduce((a, b) => a + b, 0) / forecastVals.length;
    const totalEnergyMwh = calculateTotalEnergyMWh(forecastVals);

    // Publication time span & horizon range from actual points
    const pubTimes = validPoints
      .map((p) => (p.publish_time ? new Date(p.publish_time).getTime() : 0))
      .filter((t) => t > 0);
    const minPubTime = pubTimes.length > 0 ? new Date(Math.min(...pubTimes)).toISOString() : null;
    const maxPubTime = pubTimes.length > 0 ? new Date(Math.max(...pubTimes)).toISOString() : null;

    const horizons = validPoints
      .map((p) => p.horizon_hours)
      .filter((h): h is number => h !== null);
    const minHorizon = horizons.length > 0 ? Math.min(...horizons) : null;
    const maxHorizon = horizons.length > 0 ? Math.max(...horizons) : null;

    // Lead error P90 computed directly from band
    const errorP90s = validPoints
      .map((p) => (p.band_p90_mw !== null && p.forecast_mw !== null ? p.band_p90_mw - p.forecast_mw : null))
      .filter((val): val is number => val !== null);
    const avgErrorP90 = errorP90s.length > 0 ? errorP90s.reduce((a, b) => a + b, 0) / errorP90s.length : null;

    return {
      minMw,
      maxMw,
      avgMw,
      maxPt,
      minPt,
      totalEnergyMwh,
      minPubTime,
      maxPubTime,
      minHorizon,
      maxHorizon,
      avgErrorP90,
      totalPeriods: data.points.length,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Sticky Filter Bar */}
      <div className="panel p-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="delivery-date" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Delivery Day:
            </label>
            <input
              id="delivery-date"
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-[4px] px-2.5 py-1 text-[13px] tabular-nums focus:outline-none focus:border-[var(--color-forecast)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="cutoff-selector" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              D-1 Gate:
            </label>
            <select
              id="cutoff-selector"
              value={cutoffHour}
              onChange={(e) => setCutoffHour(e.target.value)}
              className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-[4px] px-2.5 py-1 text-[13px] tabular-nums focus:outline-none focus:border-[var(--color-forecast)]"
            >
              <option value="09:00">09:00 London</option>
              <option value="11:00">11:00 London (EPEX SPOT)</option>
              <option value="12:00">12:00 London (Nord Pool)</option>
              <option value="16:00">16:00 London</option>
            </select>
          </div>
        </div>

        {/* Dynamic Publication & Horizon Range */}
        {stats && (
          <div className="flex items-center gap-4 text-[12px] tabular-nums text-[var(--text-secondary)]">
            <div>
              Published:{' '}
              <span className="text-[var(--text-primary)] font-medium">
                {formatLondonTime(stats.minPubTime)} – {formatLondonTime(stats.maxPubTime)} UTC
              </span>
            </div>
            <div className="hidden sm:block text-[var(--border-subtle)]">|</div>
            <div className="hidden sm:block">
              Lead Horizon:{' '}
              <span className="text-[var(--text-primary)] font-medium">
                {stats.minHorizon?.toFixed(1)}h – {stats.maxHorizon?.toFixed(1)}h
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="panel p-4 h-24 skeleton" />
            ))}
          </div>
          <div className="panel p-5 h-80 skeleton" />
        </div>
      )}

      {isError && (
        <div className="panel p-4 border-[var(--color-danger)] text-[var(--color-danger)] flex items-center gap-2 text-[13px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{(error as Error)?.message || 'Failed to load forecast for selected delivery day'}</span>
        </div>
      )}

      {data && stats && (
        <>
          {/* Key Metric Scorecards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Expected Wind Energy"
              value={formatGWh(stats.totalEnergyMwh)}
              subtitle={`${stats.totalEnergyMwh.toLocaleString('en-GB', { maximumFractionDigits: 0 })} MWh total`}
              explanation="Total projected wind electricity generation for delivery across all 48 settlement periods."
              formula="Σ (Forecast MW * 0.5 hours)"
            />

            <KpiCard
              label="Peak Settlement Period"
              value={formatMW(stats.maxMw)}
              subtitle={`SP ${stats.maxPt.settlement_period} · ${formatLondonTime(stats.maxPt.target_start)}`}
              explanation="Highest single half-hour generation expected during the delivery day."
            />

            <KpiCard
              label="Trough Baseline"
              value={formatMW(stats.minMw)}
              subtitle={`SP ${stats.minPt.settlement_period} · ${formatLondonTime(stats.minPt.target_start)}`}
              explanation="Lowest expected half-hour generation during the delivery day (indicates required thermal baseload)."
            />

            <KpiCard
              label="Empirical Error at P90"
              value={stats.avgErrorP90 !== null ? `±${Math.round(stats.avgErrorP90)} MW` : '--'}
              subtitle="Horizon-calibrated historical margin"
              explanation="Empirical 90th percentile error margin calibrated for this lead time horizon, excluding the target day."
              formula="Quantile(Actual - Forecast, 0.90)"
            />
          </div>

          {/* 48-point Chart & Trading Guidance Panel */}
          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between pb-3 mb-2 border-b border-[var(--border-subtle)] gap-2">
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
                  Day-Ahead Wind Forecast Profile ({deliveryDate})
                </h2>
                <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  48 settlement periods at {cutoffHour} D-1 decision gate with historical P10–P90 uncertainty envelope
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] tabular-nums">
                <span className="flex items-center gap-1.5 text-[var(--color-forecast)]">
                  <span className="w-3 h-0.5 bg-[var(--color-forecast)] inline-block" /> Latest Forecast
                </span>
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span className="w-3 h-2 bg-[var(--color-uncertainty-fill)] border border-[var(--color-forecast)] border-dashed inline-block" /> P10–P90 Band
                </span>
              </div>
            </div>

            <DecisionChart points={data.points} />
          </div>

          {/* Historical bias by time of day & Interval inspection table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="panel p-4 lg:col-span-2">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
                Settlement Period Inspection
              </h3>
              <div className="overflow-x-auto max-h-52">
                <table className="w-full text-left text-[12px] tabular-nums">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-[11px] uppercase">
                      <th className="pb-1.5 font-medium">Period</th>
                      <th className="pb-1.5 font-medium">London Time</th>
                      <th className="pb-1.5 font-medium">Horizon</th>
                      <th className="pb-1.5 font-medium text-right">Forecast (MW)</th>
                      <th className="pb-1.5 font-medium text-right">P10 Bound</th>
                      <th className="pb-1.5 font-medium text-right">P90 Bound</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {data.points.slice(0, 12).map((pt) => (
                      <tr key={pt.settlement_period} className="hover:bg-[var(--bg-subtle)]">
                        <td className="py-1 text-[var(--text-primary)] font-medium">SP {pt.settlement_period}</td>
                        <td className="py-1">{formatLondonTime(pt.target_start)}</td>
                        <td className="py-1">{pt.horizon_hours?.toFixed(1)} h</td>
                        <td className="py-1 text-right text-[var(--text-primary)] font-semibold">{formatMW(pt.forecast_mw)}</td>
                        <td className="py-1 text-right">{formatMW(pt.band_p10_mw)}</td>
                        <td className="py-1 text-right">{formatMW(pt.band_p90_mw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel p-4">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
                Historical bias by time of day
              </h3>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
                Calculated from January 2026 actuals vs forecasts at {cutoffHour} D-1:
              </p>
              {hourQuery.data && hourQuery.data.length > 0 ? (
                <div className="space-y-2 text-[12px] tabular-nums">
                  <div className="flex justify-between p-2 rounded-[4px] bg-[var(--bg-subtle)]">
                    <span className="text-[var(--text-secondary)]">Morning Ramp (06:00–09:00):</span>
                    <span className="font-semibold text-[var(--color-over-forecast)]">
                      +{Math.round(hourQuery.data.filter(h => h.hour >= 6 && h.hour <= 9).reduce((a, b) => a + b.mean_bias_mw, 0) / 4)} MW
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-[4px] bg-[var(--bg-subtle)]">
                    <span className="text-[var(--text-secondary)]">Midday Peak (11:00–14:00):</span>
                    <span className="font-semibold text-[var(--color-over-forecast)]">
                      +{Math.round(hourQuery.data.filter(h => h.hour >= 11 && h.hour <= 14).reduce((a, b) => a + b.mean_bias_mw, 0) / 4)} MW
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-[4px] bg-[var(--bg-subtle)]">
                    <span className="text-[var(--text-secondary)]">Evening Peak (17:00–20:00):</span>
                    <span className="font-semibold text-[var(--color-over-forecast)]">
                      +{Math.round(hourQuery.data.filter(h => h.hour >= 17 && h.hour <= 20).reduce((a, b) => a + b.mean_bias_mw, 0) / 4)} MW
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-[var(--text-muted)]">Loading historical bias summary...</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
