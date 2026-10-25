import React from 'react';
import { X, ExternalLink, ShieldCheck, HelpCircle } from 'lucide-react';

interface AssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssumptionsModal: React.FC<AssumptionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="glass-panel-elevated w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 border border-slate-700 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assumptions-title"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h2 id="assumptions-title" className="text-xl font-bold text-white tracking-tight">
              Data Sources, Methodology & Trading Assumptions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
            <h3 className="font-semibold text-cyan-400 text-base mb-2">
              1. Elexon BMRS Datasets & Resolution
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-slate-300">
              <li>
                <strong>Outturns (FUELHH):</strong> Actual national wind generation in Megawatts (MW) reported per 30-minute settlement period (48 per delivery day). Filtered server-side for <code className="text-amber-300">fuelType=WIND</code>.
              </li>
              <li>
                <strong>Forecasts (WINDFOR):</strong> National wind generation forecasts published in rolling hourly target steps (e.g. 10:00, 11:00 UTC).
              </li>
              <li>
                <strong>Resolution Mapping:</strong> Since half-hour settlement targets (e.g. 10:30 UTC) do not have a dedicated 30-min forecast point in WINDFOR, they are mapped to the parent hour forecast (10:00 UTC).
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
            <h3 className="font-semibold text-cyan-400 text-base mb-2">
              2. Day-Ahead Decision Gate (D-1 Cutoff)
            </h3>
            <p>
              In Great Britain's wholesale electricity market, day-ahead power auctions (such as EPEX SPOT and Nord Pool UK) clear at 11:00–12:00 London time. Power traders formulate positions ahead of time (commonly at 09:00 or 11:00 on day D-1).
            </p>
            <p className="mt-2 text-slate-300">
              For any target delivery day D, the decision forecast selects the record with the <strong>latest publication time</strong> satisfying:
            </p>
            <div className="my-2 p-2.5 rounded bg-slate-950 font-mono text-xs text-emerald-400 border border-slate-800">
              publishTime &le; Cutoff (London time converted to UTC) on DeliveryDate - 1 day
            </div>
            <p className="text-xs text-slate-400">
              This guarantees zero data leakage: only information physically available on trading desks at the selected cutoff is used.
            </p>
          </div>

          {/* Section 3 */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
            <h3 className="font-semibold text-cyan-400 text-base mb-2">
              3. Empirical Uncertainty Bands (P10 / P50 / P90)
            </h3>
            <p>
              Uncertainty bands are calibrated on historical outturn errors <code className="text-amber-300">(Actual - Forecast)</code> grouped by forecast lead horizon buckets (e.g. 12-16h, 16-20h, etc.).
            </p>
            <p className="mt-2 text-xs text-slate-400">
              <strong>Strict Anti-Leakage:</strong> When evaluating a given delivery day, the empirical quantiles exclude the delivery day's own outturn to ensure authentic out-of-sample uncertainty estimation.
            </p>
          </div>

          {/* Section 4 */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
            <h3 className="font-semibold text-cyan-400 text-base mb-2">
              4. Accuracy Metrics Definitions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="font-semibold text-white">Mean Absolute Error (MAE):</span>
                <p className="text-slate-400 mt-1">Average magnitude of error in MW. Unweighted penalty for imbalance.</p>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="font-semibold text-white">Root Mean Square Error (RMSE):</span>
                <p className="text-slate-400 mt-1">Penalizes large forecast errors quadratically (critical for systemic cashout exposure).</p>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="font-semibold text-white">Mean Bias (Forecast - Actual):</span>
                <p className="text-slate-400 mt-1">Positive bias = persistent over-forecasting (buying too much power ahead of delivery).</p>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="font-semibold text-white">Normalized MAE (NMAE):</span>
                <p className="text-slate-400 mt-1">MAE divided by mean actual generation, giving percentage error relative to generation scale.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-900/30"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
