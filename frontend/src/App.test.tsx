import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App – simplified nav', () => {
  it('renders title and all four tabs', () => {
    render(<App />);
    expect(screen.getByText('Wind Forecast Monitor')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Decision' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Accuracy' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Evolution' })).toBeInTheDocument();
  });

  it('Decision tab is selected by default', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Decision' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to Overview panel on click and shows dataset info', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Jan 2026 snapshot · Elexon BMRS/i)).toBeInTheDocument();
  });

  it('has an accessible theme-toggle button', () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: /switch to/i });
    expect(btn).toBeInTheDocument();
  });

  it('nav has no assumptions button, status indicators or help buttons', () => {
    render(<App />);
    expect(screen.queryByText('Assumptions')).not.toBeInTheDocument();
  });
});
