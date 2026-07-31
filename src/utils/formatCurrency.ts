// Always call this before displaying any monetary amount received from the API.
// API amounts are in cents (smallest currency unit). Never format inline in components.

const LOCALE_MAP: Record<string, string> = {
  RSD: 'sr-Latn-RS',
  EUR: 'de-DE',
  USD: 'en-US',
  HRK: 'hr-HR',
  BAM: 'bs-BA',
};

export function formatCurrency(amountInCents: number, currency: string): string {
  const amount = amountInCents / 100;
  const locale = LOCALE_MAP[currency.toUpperCase()] ?? 'sr-Latn-RS';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
