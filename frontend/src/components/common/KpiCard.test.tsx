import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiCard } from './KpiCard';
import { MetricTooltip } from './MetricTooltip';

describe('KpiCard Component', () => {
  it('renders label, value, unit, and subtitle properly', () => {
    render(
      <KpiCard
        label="Mean Absolute Error"
        value="2,145"
        unit="MW"
        subtitle="Average magnitude"
        explanation="Linear volume imbalance penalty"
        formula="mean(|forecast - actual|)"
      />
    );

    expect(screen.getByText('Mean Absolute Error')).toBeDefined();
    expect(screen.getByText('2,145')).toBeDefined();
    expect(screen.getByText('MW')).toBeDefined();
    expect(screen.getByText('Average magnitude')).toBeDefined();
  });
});

describe('MetricTooltip Component', () => {
  it('shows tooltip content on mouse enter', () => {
    render(
      <MetricTooltip
        label="RMSE"
        explanation="Root Mean Square Error penalizing large misses"
        formula="sqrt(mean((forecast - actual)^2))"
      >
        <span>RMSE Header</span>
      </MetricTooltip>
    );

    const trigger = screen.getByRole('generic', { name: 'RMSE details' });
    fireEvent.mouseEnter(trigger);

    expect(screen.getByRole('tooltip')).toBeDefined();
    expect(screen.getByText('Root Mean Square Error penalizing large misses')).toBeDefined();
    expect(screen.getByText('sqrt(mean((forecast - actual)^2))')).toBeDefined();
  });
});
