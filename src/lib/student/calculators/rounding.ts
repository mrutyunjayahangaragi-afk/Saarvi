/**
 * Pure Rounding Utilities.
 *
 * VTU Regulation mandates rounding off SGPA and CGPA to 2 decimal places.
 * Intermediate calculations should preserve IEEE 754 full double precision.
 */

export function roundVTU(value: number, decimals: number = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(4, decimals)));
  // Number.EPSILON prevents binary floating point rounding inaccuracies (e.g. 1.005 -> 1.01)
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatVTUNumber(value: number, decimals: number = 2): string {
  return roundVTU(value, decimals).toFixed(decimals);
}
