import React from 'react';
import { MetricTooltip } from './MetricTooltip';

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  subtitle?: string;
  explanation: string;
  formula?: string;
  status?: 'neutral' | 'positive' | 'warning' | 'danger';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  subtitle,
  explanation,
  formula,
  status = 'neutral',
}) => {
  const statusColorMap = {
    neutral: 'border-slate-800 text-slate-100',
    positive: 'border-emerald-500/30 text-emerald-400',
    warning: 'border-amber-500/30 text-amber-400',
    danger: 'border-rose-500/30 text-rose-400',
  };

  return (
    <div className={`glass-panel p-4 rounded-xl border flex flex-col justify-between ${statusColorMap[status]} transition-all hover:border-slate-700`}>
      <div className="flex items-center justify-between mb-2">
        <MetricTooltip label={label} explanation={explanation} formula={formula}>
          <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
            {label}
          </span>
        </MetricTooltip>
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className="text-2xl font-bold tracking-tight font-mono text-white">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>

      {subtitle && (
        <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">
          {subtitle}
        </span>
      )}
    </div>
  );
};
