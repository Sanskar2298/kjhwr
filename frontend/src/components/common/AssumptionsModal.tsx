import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface AssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssumptionsModal: React.FC<AssumptionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div
        className="panel-elevated w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5 border border-[var(--border-strong)] shadow-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assumptions-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--color-forecast)]" />
            <h2 id="assumptions-title" className="text-[15px] font-semibold text-[var(--text-primary)]">
              Data Sources, Methodology &amp; Trading Assumptions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          <div className="panel p-3 border border-[var(--border-subtle)]">
            <h3 className="font-semibold text-[var(--text-primary)] text-[13px] mb-1.5">
              1. Elexon BMRS Datasets &amp; Resolution
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[12px]">
              <li>
                <strong>Outturns (FUELHH):</strong> Actual national wind generation in Megawatts (MW) reported per 30-minute settlement period (48 per delivery day). Filtered server-side for <code className="text-[var(--color-forecast)]">fuelType=WIND</code>.
              </li>
              <li>
                <strong>Forecasts (WINDFOR):</strong> National wind generation forecasts published in rolling hourly target steps (e.g. 10:00, 11:00 UTC).
              </li>
              <li>
                <strong>Resolution Mapping:</strong> Since half-hour settlement targets (e.g. SP 20 · 09:30 UTC) do not have a dedicated 30-min point in WINDFOR, they map to the parent hour forecast (09:00 UTC).
              </li>
            </ul>
          </div>

          <div className="panel p-3 border border-[var(--border-subtle)]">
            <h3 className="font-semibold text-[var(--text-primary)] text-[13px] mb-1.5">
              2. Day-Ahead Decision Gate (D-1 Cutoff)
            </h3>
            <p className="text-[12px]">
              GB day-ahead power auctions clear around 11:00–12:00 London time. Traders formulate bids ahead of gate closure (e.g. 09:00 D-1).
            </p>
            <div className="my-2 p-2 rounded-[4px] bg-[var(--bg-subtle)] tabular-nums text-[11px] text-[var(--color-forecast)] border border-[var(--border-subtle)]">
              publishTime &le; Cutoff (London time converted to UTC) on Delivery Date - 1 day
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Guarantees zero data leakage: only forecasts physically published prior to the selected decision cutoff are evaluated.
            </p>
          </div>

          <div className="panel p-3 border border-[var(--border-subtle)]">
            <h3 className="font-semibold text-[var(--text-primary)] text-[13px] mb-1.5">
              3. Empirical Uncertainty Bands (P10 / P50 / P90)
            </h3>
            <p className="text-[12px]">
              Calibrated on historical errors <code className="text-[var(--color-over-forecast)]">(Actual - Forecast)</code> partitioned by lead horizon buckets.
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              <strong>Anti-Leakage Rule:</strong> When evaluating a given delivery day, empirical quantiles are computed strictly out-of-sample by excluding the delivery day's own outturn.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-[4px] bg-[var(--color-forecast)] text-[var(--bg-app)] font-medium text-[12px] hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
