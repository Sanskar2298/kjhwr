import { describe, it, expect } from 'vitest';
import {
  formatLondonTime,
  formatLondonDateTime,
  formatMW,
  calculateTotalEnergyMWh,
  formatGWh,
  formatPct,
} from './formatters';

describe('formatters utility functions', () => {
  it('formats UTC ISO strings to London 24h clock time correctly', () => {
    expect(formatLondonTime('2026-01-15T09:30:00Z')).toBe('09:30');
    expect(formatLondonTime('2026-01-15T00:00:00Z')).toBe('00:00');
    expect(formatLondonTime(null)).toBe('--:--');
    expect(formatLondonTime(undefined)).toBe('--:--');
  });

  it('formats power in Megawatts with thousands separators and unit', () => {
    expect(formatMW(14500)).toBe('14,500 MW');
    expect(formatMW(0)).toBe('0 MW');
    expect(formatMW(null)).toBe('--');
    expect(formatMW(14500.45, 1)).toBe('14,500.5 MW');
  });

  it('calculates total day energy in MWh by half-hour power integration', () => {
    // 2 half-hours of 1000 MW = 500 MWh + 500 MWh = 1000 MWh
    const series = [1000, 1000];
    expect(calculateTotalEnergyMWh(series)).toBe(1000);

    // 48 periods of 2000 MW = 48 * 1000 = 48,000 MWh
    const fullDay = Array(48).fill(2000);
    expect(calculateTotalEnergyMWh(fullDay)).toBe(48000);

    // Handles null / undefined properly
    expect(calculateTotalEnergyMWh([1000, null, 1000])).toBe(1000);
  });

  it('formats Gigawatt-hours correctly', () => {
    expect(formatGWh(48000)).toBe('48.0 GWh');
    expect(formatGWh(1530)).toBe('1.5 GWh');
  });

  it('formats percentages properly', () => {
    expect(formatPct(18.54)).toBe('18.5%');
    expect(formatPct(null)).toBe('--%');
  });
});
