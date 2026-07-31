import {
  CompletedOrderSummary,
  DashboardPeriod,
  VendorDashboardResponse,
} from '@/types';

const LOCALE_MAP: Record<string, string> = {
  en: 'en-GB',
  sr: 'sr-Latn-RS',
  hr: 'hr-HR',
  bh: 'bs-BA',
};

function resolveIntlLocale(language: string): string {
  return LOCALE_MAP[language] ?? language;
}

export function formatSellThroughRate(rate: number): string {
  if (rate < 0) return '—';
  return `${Math.round(rate * 100)}%`;
}

export function sellThroughPercent(rate: number): number | null {
  if (rate < 0) return null;
  return Math.round(rate * 100);
}

export function chartAxisLabel(
  dateStr: string,
  period: DashboardPeriod,
  language: string,
): string {
  try {
    const d = new Date(dateStr);
    const locale = resolveIntlLocale(language);

    if (period === 'today') {
      return `${d.getHours()}h`;
    }
    if (period === 'week') {
      return d.toLocaleDateString(locale, { weekday: 'short' });
    }
    if (period === 'month') {
      return `${d.getDate()}.`;
    }
    return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  } catch {
    return '';
  }
}

export function resolveCompletedOrders(
  dashboard: VendorDashboardResponse | null,
): CompletedOrderSummary[] | null {
  if (dashboard == null) return null;
  if (dashboard.completedOrdersInPeriod != null) {
    return dashboard.completedOrdersInPeriod;
  }
  return dashboard.recentCompletedOrders;
}

export function fmtShortCents(cents: number): string {
  const val = cents / 100;
  if (val >= 1000) return `${(val / 1000).toFixed(1).replace('.', ',')}k`;
  return `${Math.round(val)}`;
}

export function isOfferFilterActive(dashboard: VendorDashboardResponse | null): boolean {
  const ids = dashboard?.selectedOfferIds;
  return ids != null && ids.length > 0;
}
