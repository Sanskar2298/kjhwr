import React from 'react';

export const App: React.FC = () => {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
          UK Wind Generation Forecast Evaluation
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          BMRS Day-Ahead Market Decision Support (January 2026 Scope)
        </p>
      </header>
    </main>
  );
};

export default App;
