import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders AEROCAST brand title and trading navigation tabs', () => {
    render(<App />);
    expect(screen.getByText('AERO')).toBeInTheDocument();
    expect(screen.getByText('CAST')).toBeInTheDocument();
    expect(screen.getByText('Decision View')).toBeInTheDocument();
    expect(screen.getByText('Accuracy Analysis')).toBeInTheDocument();
    expect(screen.getByText('Forecast Evolution')).toBeInTheDocument();
  });
});
