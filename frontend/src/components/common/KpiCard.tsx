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
  const statusBorderClass = {
    neutral: 'border-[var(--border-subtle)]',
    positive: 'border-[var(--color-forecast)]',
    warning: 'border-[var(--color-over-forecast)]',
    danger: 'border-[var(--color-danger)]',
  }[status];

  return (
    <div className={`panel p-3.5 border ${statusBorderClass} flex flex-col justify-between transition-colors`}>
      <div className="flex items-center justify-between mb-1">
        <MetricTooltip label={label} explanation={explanation} formula={formula}>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            {label}
          </span>
        </MetricTooltip>
      </div>

      <div className="flex items-baseline gap-1 my-0.5">
        <span className="text-[22px] font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
          {value}
        </span>
        {unit && (
          <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>

      {subtitle && (
        <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 tabular-nums truncate">
          {subtitle}
        </span>
      )}
    </div>
  );
};
