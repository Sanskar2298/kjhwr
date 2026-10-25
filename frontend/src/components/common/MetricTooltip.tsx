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
      <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-cyan-400 transition-colors" />

      {isVisible && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs shadow-xl text-slate-200 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="font-semibold text-cyan-400 mb-1">{label}</div>
          <div className="text-slate-300 leading-relaxed">{explanation}</div>
          {formula && (
            <div className="mt-2 pt-1 border-t border-slate-800 text-[11px] font-mono text-amber-300">
              {formula}
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
