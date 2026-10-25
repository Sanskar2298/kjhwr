/**
 * Pure utility functions for energy market units, timestamp conversions,
 * statistical metrics formatting, and uncertainty band calculations.
 */

/**
 * Format a UTC ISO string to London wall-clock time string (HH:MM).
 */
export function formatLondonTime(isoUtc: string | null | undefined): string {
  if (!isoUtc) return '--:--';
  const d = new Date(isoUtc);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format a UTC ISO string to London full date-time string.
 */
export function formatLondonDateTime(isoUtc: string | null | undefined): string {
  if (!isoUtc) return '--';
  const d = new Date(isoUtc);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' GMT';
}

/**
 * Format power in Megawatts with thousand separators.
 */
export function formatMW(val: number | null | undefined, decimals = 0): string {
  if (val === null || val === undefined || isNaN(val)) return '--';
  return val.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + ' MW';
}

/**
 * Format total day energy in Megawatt-hours (MWh) or Gigawatt-hours (GWh).
 * Half-hourly power in MW integrated across 30 mins: MWh = MW * 0.5.
 */
export function calculateTotalEnergyMWh(powerSeriesMw: (number | null | undefined)[]): number {
  return powerSeriesMw.reduce((acc: number, p) => {
    if (p !== null && p !== undefined && !isNaN(p)) {
      return acc + p * 0.5;
    }
    return acc;
  }, 0);
}

export function formatGWh(mwh: number): string {
  return (mwh / 1000).toLocaleString('en-GB', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + ' GWh';
}

/**
 * Format percentage.
 */
export function formatPct(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return '--%';
  return val.toFixed(decimals) + '%';
}
