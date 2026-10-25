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
  Legend,
  ReferenceLine,
} from 'recharts';
import { GitCommit, Clock, Target, ArrowRight } from 'lucide-react';
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

  // Calculate actual generation if available or difference between first and last forecast
  const revisions = data?.revisions || [];
  const latestForecast = revisions.length > 0 ? revisions[revisions.length - 1].generation_mw : null;
  const earliestForecast = revisions.length > 0 ? revisions[0].generation_mw : null;
  const totalRevisionMW = latestForecast !== null && earliestForecast !== null ? latestForecast - earliestForecast : null;

  return (
    <div className="space-y-6">
      {/* Target selector banner */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <label htmlFor="target-time-select" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Target Delivery Half-Hour (UTC):
            </label>
            <select
              id="target-time-select"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="2026-01-08T12:00:00Z">2026-01-08 12:00 UTC (Midday Low Wind)</option>
              <option value="2026-01-15T12:00:00Z">2026-01-15 12:00 UTC (Mid-month Baseline)</option>
              <option value="2026-01-20T18:00:00Z">2026-01-20 18:00 UTC (Evening Peak Demand)</option>
              <option value="2026-01-28T06:00:00Z">2026-01-28 06:00 UTC (High Volatility Ramp)</option>
              <option value="2026-01-31T12:00:00Z">2026-01-31 12:00 UTC (Month-End Outturn)</option>
            </select>
          </div>
        </div>

        {revisions.length > 0 && (
          <div className="text-xs text-slate-400 font-mono">
            {revisions.length} sequential forecast revisions published ahead of delivery
          </div>
        )}
      </div>

      {/* Summary revision card */}
      {revisions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Earliest Forecast</div>
            <div className="text-xl font-bold font-mono text-slate-200">{formatMW(earliestForecast)}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Published at {revisions[0].horizon_hours.toFixed(0)}h lead
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Final Decision Forecast</div>
            <div className="text-xl font-bold font-mono text-cyan-400">{formatMW(latestForecast)}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Final published outturn forecast
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Cumulative Revision Drift</div>
            <div className={`text-xl font-bold font-mono ${totalRevisionMW && totalRevisionMW >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {totalRevisionMW !== null ? `${totalRevisionMW > 0 ? '+' : ''}${formatMW(totalRevisionMW)}` : '--'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Drift between earliest and final forecast
            </div>
          </div>
        </div>
      )}

      {/* Forecast Convergence Evolution Chart */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800">
        <h3 className="text-base font-semibold text-white tracking-tight mb-1 flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-cyan-400" />
          Forecast Revision Trajectory Toward Delivery
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Tracking sequential WINDFOR updates published as lead horizon shrinks toward the delivery window
        </p>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-500">Loading forecast trajectory...</div>
        ) : isError ? (
          <div className="text-rose-400 text-sm p-4">Error loading revisions: {(error as Error)?.message}</div>
        ) : revisions.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revisions} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="publish_time"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => val.slice(5, 16).replace('T', ' ')}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(1)} GW`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="glass-panel-elevated p-2.5 rounded-lg border border-slate-700 text-xs text-slate-200">
                          <div className="font-semibold text-cyan-400 mb-1">
                            Published: {formatLondonDateTime(d.publish_time)}
                          </div>
                          <div>
                            Forecast Generation: <span className="font-mono text-white font-bold">{formatMW(d.generation_mw)}</span>
                          </div>
                          <div>
                            Lead Horizon: <span className="font-mono text-amber-400">{d.horizon_hours.toFixed(1)} hrs ahead</span>
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
                  name="Forecast Revision (MW)"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#06b6d4' }}
                  activeDot={{ r: 6, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-slate-400 text-sm p-4 text-center">No revision history found for target half-hour.</div>
        )}
      </div>
    </div>
  );
};
