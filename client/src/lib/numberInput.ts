/**
 * Parse the calculator's Vietnamese number format:
 * - comma is the decimal separator: 1,25 -> 1.25
 * - dot is the thousands separator: 1.234.567,89 -> 1234567.89
 */
export function parseLocaleNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const normalized = value.trim().replace(/[\s\u00A0]/g, "").replace(/\./g, "").replace(/,/g, ".");
  return normalized ? Number(normalized) : Number.NaN;
}
