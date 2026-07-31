const LOCALE_MAP: Record<string, string> = {
  sr: 'sr-Latn-RS',
  en: 'en-GB',
  hr: 'hr-HR',
  bh: 'bs-BA',
};

/**
 * Converts a YYYY-MM-DD date string to a human-readable locale date.
 * @example formatDate('2026-03-23', 'sr') → '23. mart 2026.'
 */
export function formatDate(isoDate: string, locale = 'sr'): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString(LOCALE_MAP[locale] ?? 'sr-Latn-RS', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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

/** Formats an ISO 8601 pickup deadline for display. */
export function formatPickupDeadline(isoDateTime: string, locale = 'sr'): string {
  const date = new Date(isoDateTime);
  return date.toLocaleString(LOCALE_MAP[locale] ?? 'sr-Latn-RS', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
