// Order API amounts are in major currency units (e.g. 365.0 RSD).
// Distinct from offer prices and formatCurrency() which use cents.

const LOCALE_MAP: Record<string, string> = {
  RSD: 'sr-Latn-RS',
  EUR: 'de-DE',
  USD: 'en-US',
  HRK: 'hr-HR',
  BAM: 'bs-BA',
};

export function formatOrderAmount(amountMajor: number, currency: string): string {
  const locale = LOCALE_MAP[currency.toUpperCase()] ?? 'sr-Latn-RS';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMajor);
}
