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
} from 'recharts';
import { DecisionForecastPoint } from '../../types/api';
import { formatLondonTime, formatLondonDateTime, formatMW } from '../../utils/formatters';

interface DecisionChartProps {
  points: DecisionForecastPoint[];
}

export const DecisionChart: React.FC<DecisionChartProps> = ({ points }) => {
  const chartData = points.map((p) => {
    const timeLabel = formatLondonTime(p.target_start);
    const forecast = p.forecast_mw !== null ? Math.round(p.forecast_mw) : null;
    const bandP10 = p.band_p10_mw !== null ? Math.round(p.band_p10_mw) : null;
    const bandP90 = p.band_p90_mw !== null ? Math.round(p.band_p90_mw) : null;

    return {
      period: p.settlement_period,
      timeLabel,
      targetStart: p.target_start,
      publishTime: p.publish_time,
      horizon: p.horizon_hours,
      forecast,
      bandP10,
      bandP90,
    };
  });

  return (
    <div className="w-full h-72 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="var(--chart-grid)" vertical={false} />

          <XAxis
            dataKey="timeLabel"
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            interval={3}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-subtle)' }}
          />

          <YAxis
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            tickFormatter={(val) => `${(val / 1000).toFixed(0)} GW`}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="panel-elevated p-2.5 text-[12px] shadow-sm text-[var(--text-primary)]">
                    <div className="font-semibold text-[var(--color-forecast)] mb-1 tabular-nums">
                      SP {data.period} · {data.timeLabel} London
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between gap-5">
                        <span className="text-[var(--text-secondary)]">Decision Forecast:</span>
                        <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                          {formatMW(data.forecast)}
                        </span>
                      </div>
                      {data.bandP10 !== null && data.bandP90 !== null && (
                        <div className="flex justify-between gap-5">
                          <span className="text-[var(--text-secondary)]">P10–P90 Band:</span>
                          <span className="tabular-nums text-[var(--color-forecast)]">
                            {formatMW(data.bandP10)} – {formatMW(data.bandP90)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-5 pt-1 border-t border-[var(--border-subtle)]">
                        <span className="text-[var(--text-secondary)]">Published:</span>
                        <span className="tabular-nums text-[11px] text-[var(--text-secondary)]">
                          {formatLondonDateTime(data.publishTime)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-5">
                        <span className="text-[var(--text-secondary)]">Lead Horizon:</span>
                        <span className="tabular-nums text-[var(--text-primary)]">
                          {data.horizon !== null ? `${data.horizon.toFixed(1)} h` : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          {/* Low-opacity uncertainty band area */}
          <Area
            type="monotone"
            dataKey="bandP90"
            name="P90 Bound"
            stroke="var(--color-forecast)"
            strokeDasharray="2 2"
            strokeWidth={1}
            fill="var(--color-uncertainty-fill)"
            isAnimationActive={false}
          />

          <Area
            type="monotone"
            dataKey="bandP10"
            name="P10 Bound"
            stroke="var(--color-forecast)"
            strokeDasharray="2 2"
            strokeWidth={1}
            fill="var(--bg-surface)"
            isAnimationActive={false}
          />

          {/* 1.5px clean Forecast Line */}
          <Line
            type="monotone"
            dataKey="forecast"
            name="Decision Forecast"
            stroke="var(--color-forecast)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-forecast)', stroke: 'var(--bg-surface)', strokeWidth: 1.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
