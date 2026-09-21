import { DashboardPeriod } from '@/types';

/**
 * ISO-8601 UTC datetime ending in Z (e.g. 2026-01-01T00:00:00.000Z).
 * Prefer Z over +01:00 so query-string encoding never turns `+` into a space
 * (which breaks Java OffsetDateTime.parse on the backend).
 */
export function toOffsetIsoDateTime(date: Date): string {
  return date.toISOString();
}

/**
 * Maps dashboard period tabs to optional `from` / `to` query params for stats endpoints.
 * Omits both for `all` (backend default range).
 */
export function periodToStatsDateRange(period: DashboardPeriod): {
  from?: string;
  to?: string;
} {
  if (period === 'all') {
    return {};
  }

  const now = new Date();
  const start = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    default:
      break;
  }

  return { from: toOffsetIsoDateTime(start), to: toOffsetIsoDateTime(now) };
}
