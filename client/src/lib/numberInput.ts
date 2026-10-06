/**
 * Parse calculator input using one unambiguous rule:
 * - comma and dot are both accepted as the decimal separator
 * - dot is never treated as a thousands separator
 * - values containing more than one decimal separator are invalid
 */
export function parseLocaleNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const compact = value.trim().replace(/[\s\u00A0]/g, "").replace(/\./g, ",");
  if ((compact.match(/,/g) ?? []).length > 1) return Number.NaN;
  const normalized = compact.replace(/,/g, ".");
  return normalized ? Number(normalized) : Number.NaN;
}
