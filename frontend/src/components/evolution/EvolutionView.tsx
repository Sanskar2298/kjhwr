import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Clock } from 'lucide-react';
import { apiClient } from '../../api/client';
import { formatMW, formatLondonDateTime } from '../../utils/formatters';

interface EvolutionViewProps {
  initialTarget?: string;
}

export const EvolutionView: React.FC<EvolutionViewProps> = ({
  initialTarget = '2026-01-15T12:00:00Z',
}) => {
  const [targetTime, setTargetTime] = useState(initialTarget);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['forecastEvolution', targetTime],
    queryFn: () => apiClient.getForecastEvolution(targetTime),
  });

  const revisions = data?.revisions || [];
  const latestForecast = revisions.length > 0 ? revisions[revisions.length - 1].generation_mw : null;
  const earliestForecast = revisions.length > 0 ? revisions[0].generation_mw : null;
  const totalRevisionMW = latestForecast !== null && earliestForecast !== null ? latestForecast - earliestForecast : null;

  return (
    <div className="space-y-4">
      {/* Target Selector Bar */}
      <div className="panel p-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[var(--color-forecast)]" />
            <label htmlFor="target-time-select" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Target Delivery Half-Hour (UTC):
            </label>
            <select
              id="target-time-select"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-[4px] px-2.5 py-1 text-[13px] tabular-nums focus:outline-none focus:border-[var(--color-forecast)]"
            >
              <option value="2026-01-08T12:00:00Z">2026-01-08 12:00 UTC (SP 25 · Low Wind Regime)</option>
              <option value="2026-01-15T12:00:00Z">2026-01-15 12:00 UTC (SP 25 · Baseline Day)</option>
              <option value="2026-01-20T18:00:00Z">2026-01-20 18:00 UTC (SP 37 · Evening Peak)</option>
              <option value="2026-01-28T06:00:00Z">2026-01-28 06:00 UTC (SP 13 · Volatile Ramp Event)</option>
              <option value="2026-01-31T12:00:00Z">2026-01-31 12:00 UTC (SP 25 · Month-End Delivery)</option>
            </select>
          </div>
        </div>

        {revisions.length > 0 && (
          <div className="text-[12px] text-[var(--text-secondary)] tabular-nums">
            {revisions.length} sequential forecast revisions published ahead of target
          </div>
        )}
      </div>

      {/* Revision Scorecards */}
      {revisions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="panel p-3.5">
            <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Earliest Published Forecast</div>
            <div className="text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">{formatMW(earliestForecast)}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 tabular-nums">
              Published at {revisions[0].horizon_hours.toFixed(1)}h lead
            </div>
          </div>

          <div className="panel p-3.5">
            <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Final Published Forecast</div>
            <div className="text-[20px] font-semibold tabular-nums text-[var(--color-forecast)]">{formatMW(latestForecast)}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 tabular-nums">
              Published at {revisions[revisions.length - 1].horizon_hours.toFixed(1)}h lead
            </div>
          </div>

          <div className="panel p-3.5">
            <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Cumulative Revision Drift</div>
            <div className={`text-[20px] font-semibold tabular-nums ${totalRevisionMW && totalRevisionMW >= 0 ? 'text-[var(--color-over-forecast)]' : 'text-[var(--color-under-forecast)]'}`}>
              {totalRevisionMW !== null ? `${totalRevisionMW > 0 ? '+' : ''}${formatMW(totalRevisionMW)}` : '--'}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Net update from first to final forecast
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="panel p-3.5 h-20 skeleton" />
          ))}
        </div>
      )}

      {/* Trajectory Step Chart */}
      <div className="panel p-4">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-0.5">
          Forecast Revision Trajectory
        </h3>
        <div className="text-[12px] text-[var(--text-secondary)] mb-3">
          Tracking WINDFOR updates as lead horizon shrinks toward delivery window
        </div>

        {isLoading ? (
          <div className="h-64 skeleton" />
        ) : isError ? (
          <div className="text-[var(--color-danger)] text-[12px] p-3">Failed to load trajectory: {(error as Error)?.message}</div>
        ) : revisions.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revisions} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="publish_time"
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickFormatter={(val) => val.slice(5, 16).replace('T', ' ')}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(1)} GW`}
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
                            {formatLondonDateTime(d.publish_time)}
                          </div>
                          <div>
                            Forecast Generation: <span className="tabular-nums font-semibold">{formatMW(d.generation_mw)}</span>
                          </div>
                          <div>
                            Lead Horizon: <span className="tabular-nums text-[var(--text-secondary)]">{d.horizon_hours.toFixed(1)} h ahead</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="stepAfter"
                  dataKey="generation_mw"
                  name="Revision MW"
                  stroke="var(--color-forecast)"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: 'var(--color-forecast)' }}
                  activeDot={{ r: 5, fill: 'var(--color-forecast)', stroke: 'var(--bg-surface)', strokeWidth: 1.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-[var(--text-secondary)] text-[12px] p-4 text-center">No revision history found.</div>
        )}
      </div>
    </div>
  );
};
