const LOCALE_MAP: Record<string, string> = {
  sr: 'sr-Latn-RS',
  en: 'en-GB',
  hr: 'hr-HR',
  bh: 'bs-BA',
};

/** Balkan vendor wall-clock timezone (Serbia, Croatia, Bosnia). */
export const VENDOR_TIME_ZONE = 'Europe/Belgrade';

export interface VendorPickupFields {
  pickupDate?: string;
  pickupStartTime?: string;
  pickupEndTime?: string;
  pickupBy?: string;
}

function localeTag(locale: string): string {
  return LOCALE_MAP[locale] ?? 'sr-Latn-RS';
}

/**
 * Converts a YYYY-MM-DD date string to a human-readable locale date.
 * @example formatDate('2026-03-23', 'sr') → '23. mart 2026.'
 */
export function formatDate(isoDate: string, locale = 'sr'): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString(localeTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Calendar date from a YYYY-MM-DD pickup date — never shifted by timezone.
 * @example formatShortPickupDate('2026-09-18', 'sr') → '18. sep'
 */
export function formatShortPickupDate(ymd: string, locale = 'sr'): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day).toLocaleDateString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Strips seconds from a HH:MM:SS time string.
 * @example formatPickupTime('14:30:00') → '14:30'
 */
export function formatPickupTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Formats a pickup window from two HH:MM:SS strings.
 * @example formatPickupWindow('14:00:00', '16:30:00') → '14:00 - 16:30'
 */
export function formatPickupWindow(start: string, end: string): string {
  return `${formatPickupTime(start)} - ${formatPickupTime(end)}`;
}

/** Date + HH:MM as written in an ISO string, ignoring any Z / offset. */
function wallClockFromIso(isoDateTime: string): { date: string; time: string } | null {
  const match = isoDateTime.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (!match) return null;
  return { date: match[1], time: match[2] };
}

/**
 * Vendor-local pickup deadline. Uses the date/time written in the payload
 * (same wall clock vendors enter), and does not convert through the phone TZ.
 */
export function formatPickupDeadline(isoDateTime: string, locale = 'sr'): string {
  const wall = wallClockFromIso(isoDateTime);
  if (wall) {
    return `${formatShortPickupDate(wall.date, locale)} ${wall.time}`;
  }
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleString(localeTag(locale), {
    timeZone: VENDOR_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Real instant (payouts, settlement) in the device locale.
 * Do not use this for offer/reservation pickup clocks.
 */
export function formatInstant(isoDateTime: string, locale = 'sr'): string {
  const date = new Date(isoDateTime);
  return date.toLocaleString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Pickup schedule in vendor local time — same clock as offer cards/details.
 * Prefers pickupDate + start/end window; falls back to pickupBy wall clock.
 */
export function formatVendorPickupSchedule(
  fields: VendorPickupFields,
  locale = 'sr',
): string | null {
  const window =
    fields.pickupStartTime && fields.pickupEndTime
      ? formatPickupWindow(fields.pickupStartTime, fields.pickupEndTime)
      : fields.pickupEndTime
        ? formatPickupTime(fields.pickupEndTime)
        : fields.pickupStartTime
          ? formatPickupTime(fields.pickupStartTime)
          : null;

  const dateYmd =
    fields.pickupDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ??
    wallClockFromIso(fields.pickupBy ?? '')?.date;

  if (dateYmd && window) {
    return `${formatShortPickupDate(dateYmd, locale)}, ${window}`;
  }
  if (window) return window;
  if (fields.pickupBy) return formatPickupDeadline(fields.pickupBy, locale);
  if (dateYmd) return formatShortPickupDate(dateYmd, locale);
  return null;
}

/**
 * Returns a relative time string for recent times, falling back to a full date for older ones.
 */
export function formatRelativeTime(
  isoDateTime: string,
  t?: (key: string, options?: Record<string, unknown>) => string,
): string {
  const translate =
    t ??
    ((key: string, options?: Record<string, unknown>) => {
      // Lazy import avoided — callers should pass `t` from useTranslation
      const count = options?.count;
      if (key === 'notifications.relativeJustNow') return 'upravo';
      if (key === 'notifications.relativeMinutes') return `pre ${count} min`;
      if (key === 'notifications.relativeHours') return `pre ${count} h`;
      if (key === 'notifications.relativeDays') return `pre ${count} d`;
      return key;
    });

  const date = new Date(isoDateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return translate('notifications.relativeJustNow');
  if (diffMin < 60) return translate('notifications.relativeMinutes', { count: diffMin });
  if (diffHours < 24) return translate('notifications.relativeHours', { count: diffHours });
  if (diffDays < 7) return translate('notifications.relativeDays', { count: diffDays });
  return formatDate(isoDateTime.slice(0, 10));
}
