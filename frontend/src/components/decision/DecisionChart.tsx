import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { DecisionForecastPoint } from '../../types/api';
import { formatLondonTime, formatLondonDateTime, formatMW } from '../../utils/formatters';

interface DecisionChartProps {
  points: DecisionForecastPoint[];
}

export const DecisionChart: React.FC<DecisionChartProps> = ({ points }) => {
  // Prepare chart dataset: calculate upper and lower uncertainty envelopes
  const chartData = points.map((p) => {
    const timeLabel = formatLondonTime(p.target_start);
    const forecast = p.forecast_mw !== null ? Math.round(p.forecast_mw) : null;
    const bandP10 = p.band_p10_mw !== null ? Math.round(p.band_p10_mw) : null;
    const bandP90 = p.band_p90_mw !== null ? Math.round(p.band_p90_mw) : null;

    // Uncertainty band range for stacked Area or custom Area
    // band_p10_mw is lower bound (e.g. 10th percentile of actual), band_p90 is upper bound
    return {
      period: p.settlement_period,
      timeLabel,
      targetStart: p.target_start,
      publishTime: p.publish_time,
      horizon: p.horizon_hours,
      forecast,
      bandP10,
      bandP90,
      // band width for stacked area if needed:
      bandRange: bandP10 !== null && bandP90 !== null ? Math.max(0, bandP90 - bandP10) : null,
    };
  });

  return (
    <div className="w-full h-80 sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
          <defs>
            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="uncertaintyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

          <XAxis
            dataKey="timeLabel"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            interval={3}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />

          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(val) => `${(val / 1000).toFixed(1)} GW`}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="glass-panel-elevated p-3 rounded-lg border border-slate-700 text-xs shadow-xl text-slate-200">
                    <div className="font-semibold text-cyan-400 mb-1">
                      Period {data.period} ({data.timeLabel} London)
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Forecast:</span>
                        <span className="font-mono font-bold text-white">
                          {formatMW(data.forecast)}
                        </span>
                      </div>
                      {data.bandP10 !== null && data.bandP90 !== null && (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">P10 - P90 Band:</span>
                          <span className="font-mono text-cyan-300">
                            {formatMW(data.bandP10)} - {formatMW(data.bandP90)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Published:</span>
                        <span className="text-slate-300 font-mono text-[11px]">
                          {formatLondonDateTime(data.publishTime)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Lead Horizon:</span>
                        <span className="text-amber-400 font-mono font-semibold">
                          {data.horizon !== null ? `${data.horizon.toFixed(1)} hrs` : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
          />

          {/* Uncertainty Band area */}
          <Area
            type="monotone"
            dataKey="bandP90"
            name="Uncertainty Bound (P90)"
            stroke="#38bdf8"
            strokeDasharray="4 4"
            strokeWidth={1}
            fill="url(#uncertaintyGradient)"
            isAnimationActive={false}
          />

          <Area
            type="monotone"
            dataKey="bandP10"
            name="Uncertainty Bound (P10)"
            stroke="#0284c7"
            strokeDasharray="4 4"
            strokeWidth={1}
            fill="#07090e"
            isAnimationActive={false}
          />

          {/* Main Decision Forecast line */}
          <Line
            type="monotone"
            dataKey="forecast"
            name="Latest Decision Forecast (MW)"
            stroke="#06b6d4"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
