import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface MetricTooltipProps {
  label: string;
  explanation: string;
  formula?: string;
  children: React.ReactNode;
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  label,
  explanation,
  formula,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex items-center gap-1 group cursor-help"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      tabIndex={0}
      aria-label={`${label} details`}
    >
      {children}
      <HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-forecast)] transition-colors" />

      {isVisible && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-0 mb-1.5 w-64 p-2.5 rounded-[4px] bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[12px] shadow-sm text-[var(--text-primary)] pointer-events-none"
        >
          <div className="font-semibold text-[var(--color-forecast)] mb-1">{label}</div>
          <div className="text-[var(--text-secondary)] leading-normal">{explanation}</div>
          {formula && (
            <div className="mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] text-[11px] tabular-nums text-[var(--color-over-forecast)]">
              {formula}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
