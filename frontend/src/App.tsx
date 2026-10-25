import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sun, Moon } from 'lucide-react';
import { DecisionView } from './components/decision/DecisionView';
import { AccuracyView } from './components/accuracy/AccuracyView';
import { EvolutionView } from './components/evolution/EvolutionView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

type TabType = 'overview' | 'decision' | 'accuracy' | 'evolution';

const TABS: { id: TabType; label: string; key: string }[] = [
  { id: 'overview',  label: 'Overview',  key: '0' },
  { id: 'decision',  label: 'Decision',  key: '1' },
  { id: 'accuracy',  label: 'Accuracy',  key: '2' },
  { id: 'evolution', label: 'Evolution', key: '3' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('decision');
  const [deliveryDate, setDeliveryDate] = useState('2026-01-15');
  const [cutoffHour, setCutoffHour] = useState('09:00');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Keyboard shortcuts: 1 (Decision), 2 (Accuracy), 3 (Evolution), T (Theme)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (e.key === '1') setActiveTab('decision');
      else if (e.key === '2') setActiveTab('accuracy');
      else if (e.key === '3') setActiveTab('evolution');
      else if (e.key === 't' || e.key === 'T') toggleTheme();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col font-sans">

        {/* ── Top Navigation ── */}
        <nav
          aria-label="Main navigation"
          style={{
            height: '48px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'stretch',
            paddingLeft: '16px',
            paddingRight: '12px',
          }}
        >
          {/* Left: Title + Tabs */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', flex: 1, minWidth: 0 }}>
            {/* Brand */}
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                paddingRight: '20px',
                flexShrink: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Wind Forecast Monitor
            </span>

            {/* Tab list — scrollable below 1024px */}
            <div
              role="tablist"
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: '0',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 14px',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isActive
                        ? '2px solid var(--color-forecast)'
                        : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'color 120ms ease',
                      whiteSpace: 'nowrap',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                      }
                    }}
                    onFocus={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        '0 0 0 2px var(--color-forecast)';
                      (e.currentTarget as HTMLButtonElement).style.borderRadius = '2px';
                    }}
                    onBlur={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Theme toggle only */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
            <button
              id="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode (T)`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'color 120ms ease, border-color 120ms ease',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.color = 'var(--text-primary)';
                btn.style.borderColor = 'var(--border-strong)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.color = 'var(--text-secondary)';
                btn.style.borderColor = 'var(--border-subtle)';
              }}
            >
              {theme === 'dark'
                ? <Sun  width={16} height={16} aria-hidden="true" />
                : <Moon width={16} height={16} aria-hidden="true" />}
            </button>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
          {/* Overview panel */}
          {activeTab === 'overview' && (
            <div
              id="panel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
              style={{ padding: '24px 0' }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
                Overview
              </h2>

              {/* Dataset info moved here from the old nav */}
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Dataset: Jan 2026 snapshot · Elexon BMRS
              </p>

              <details style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '12px 16px' }}>
                <summary style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  Methodology &amp; Assumptions
                </summary>
                <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <p><strong>Decision cutoff:</strong> Forecasts are evaluated at the specified cutoff hour on the day before delivery (D-1), matching the GB day-ahead auction gate closure. Only forecasts available strictly before that hour are used.</p>
                  <p style={{ marginTop: '8px' }}><strong>Uncertainty bands:</strong> Empirical leave-one-day-out calibration — no future data leaks into the band width estimate for any given day.</p>
                  <p style={{ marginTop: '8px' }}><strong>Timezone:</strong> All raw timestamps are UTC (Elexon BMRS). Displayed times are Europe/London, accounting for DST transitions within the January 2026 window (all UTC+0 for this dataset).</p>
                  <p style={{ marginTop: '8px' }}><strong>Scope:</strong> January 2026 only. No live feed — this is a static snapshot for analysis and interview purposes.</p>
                  <p style={{ marginTop: '8px' }}><strong>Imbalance cost:</strong> Proxy only. Uses a fixed £/MWh spread; real prices require BM settlement data.</p>
                </div>
              </details>
            </div>
          )}

          {activeTab === 'decision' && (
            <div id="panel-decision" role="tabpanel" aria-labelledby="tab-decision">
              <DecisionView
                deliveryDate={deliveryDate}
                setDeliveryDate={setDeliveryDate}
                cutoffHour={cutoffHour}
                setCutoffHour={setCutoffHour}
              />
            </div>
          )}

          {activeTab === 'accuracy' && (
            <div id="panel-accuracy" role="tabpanel" aria-labelledby="tab-accuracy">
              <AccuracyView cutoffHour={cutoffHour} />
            </div>
          )}

          {activeTab === 'evolution' && (
            <div id="panel-evolution" role="tabpanel" aria-labelledby="tab-evolution">
              <EvolutionView />
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          padding: '8px 16px',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px' }}>
            <span>
              Jan 2026 snapshot · <span style={{ fontFamily: 'var(--font-mono)' }}>Elexon BMRS</span> (FUELHH &amp; WINDFOR) · Timestamps UTC, displayed Europe/London
            </span>
            <span>Day-ahead auction trading evaluation · January 2026 delivery window</span>
          </div>
        </footer>

      </div>
    </QueryClientProvider>
  );
}

export default App;
