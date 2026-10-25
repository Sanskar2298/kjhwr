import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Compass,
  BarChart3,
  GitCompare,
  Info,
  Sun,
  Moon,
} from 'lucide-react';
import { DecisionView } from './components/decision/DecisionView';
import { AccuracyView } from './components/accuracy/AccuracyView';
import { EvolutionView } from './components/evolution/EvolutionView';
import { AssumptionsModal } from './components/common/AssumptionsModal';

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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col font-sans">
        {/* Top Header */}
        <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 sm:px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* Title & Static Dataset Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                  Wind Forecast Monitor
                </h1>
                <span className="text-[11px] tabular-nums text-[var(--text-muted)] font-mono">
                  v0.1.0 · UK D-1
                </span>
              </div>

              <div className="hidden sm:block text-[var(--border-subtle)]">|</div>

              <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-forecast)]" />
                <span>Dataset: Jan 2026 snapshot · Elexon BMRS</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 p-0.5 bg-[var(--bg-app)] rounded-[4px] border border-[var(--border-subtle)]" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'decision'}
                onClick={() => setActiveTab('decision')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-[12px] font-medium transition-colors ${
                  activeTab === 'decision'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Decision View
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'accuracy'}
                onClick={() => setActiveTab('accuracy')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-[12px] font-medium transition-colors ${
                  activeTab === 'accuracy'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Accuracy Analysis
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'evolution'}
                onClick={() => setActiveTab('evolution')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-[12px] font-medium transition-colors ${
                  activeTab === 'evolution'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                Forecast Evolution
              </button>
            </nav>

            {/* Actions: Theme Toggle & About */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-[4px] bg-[var(--bg-app)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setIsAssumptionsOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[12px] font-medium bg-[var(--bg-app)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors"
                aria-label="Open assumptions and methodology"
              >
                <Info className="w-3.5 h-3.5 text-[var(--color-forecast)]" />
                <span>Assumptions</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
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

        {/* Footer */}
        <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2.5 px-4 text-xs text-[var(--text-muted)]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div>
              Source: <span className="text-[var(--text-secondary)] font-mono">Elexon BMRS</span> (FUELHH &amp; WINDFOR). Timestamps stored in UTC, displayed in Europe/London.
            </div>
            <div>
              Day-ahead auction trading evaluation · January 2026 delivery window
            </div>
          </div>
        </footer>

        {/* Assumptions Modal */}
        <AssumptionsModal
          isOpen={isAssumptionsOpen}
          onClose={() => setIsAssumptionsOpen(false)}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;
