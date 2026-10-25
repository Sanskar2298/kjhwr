import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders application title', () => {
    render(<App />);
    expect(screen.getByText(/UK Wind Generation Forecast Evaluation/i)).toBeInTheDocument();
  });
});
