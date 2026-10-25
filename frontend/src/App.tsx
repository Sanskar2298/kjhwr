import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Wind,
  Compass,
  BarChart3,
  GitCompare,
  Info,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { DecisionView } from './components/decision/DecisionView';
import { AccuracyView } from './components/accuracy/AccuracyView';
import { EvolutionView } from './components/evolution/EvolutionView';
import { AssumptionsModal } from './components/common/AssumptionsModal';

// Initialize TanStack Query Client with caching defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

type TabType = 'decision' | 'accuracy' | 'evolution';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('decision');
  const [deliveryDate, setDeliveryDate] = useState('2026-01-15');
  const [cutoffHour, setCutoffHour] = useState('09:00');
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
        {/* Top Navigation Bar */}
        <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            {/* Branding & Status */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Wind className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                    AERO<span className="text-cyan-400">CAST</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                      UK D-1
                    </span>
                  </h1>
                </div>
                <p className="text-xs text-slate-400">
                  National Wind Generation Day-Ahead Decision & Accuracy Desk
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'decision'}
                onClick={() => setActiveTab('decision')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'decision'
                    ? 'bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Decision View
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'accuracy'}
                onClick={() => setActiveTab('accuracy')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'accuracy'
                    ? 'bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Accuracy Analysis
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'evolution'}
                onClick={() => setActiveTab('evolution')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'evolution'
                    ? 'bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                Forecast Evolution
              </button>
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAssumptionsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors"
                aria-label="Open assumptions and methodology"
              >
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                About Data & Assumptions
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
          {activeTab === 'decision' && (
            <DecisionView
              deliveryDate={deliveryDate}
              setDeliveryDate={setDeliveryDate}
              cutoffHour={cutoffHour}
              setCutoffHour={setCutoffHour}
            />
          )}

          {activeTab === 'accuracy' && (
            <AccuracyView cutoffHour={cutoffHour} />
          )}

          {activeTab === 'evolution' && (
            <EvolutionView />
          )}
        </main>

        {/* Trader Disclaimer Footer */}
        <footer className="border-t border-slate-900/80 bg-slate-950/40 py-4 px-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div>
              Data source: <span className="text-slate-400 font-mono">Elexon BMRS</span> (FUELHH outturn &amp; WINDFOR forecasts). All timestamps UTC internally, displayed in Europe/London.
            </div>
            <div className="text-[11px] text-slate-500">
              Evaluated Scope: January 2026 Delivery Decisions. Designed for UK Day-Ahead Power Desks.
            </div>
          </div>
        </footer>

        {/* Assumptions & Methodology Drawer/Modal */}
        <AssumptionsModal
          isOpen={isAssumptionsOpen}
          onClose={() => setIsAssumptionsOpen(false)}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;
