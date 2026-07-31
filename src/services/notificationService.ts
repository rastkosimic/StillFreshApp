import apiClient from './apiClient';
import { API_NOTIFICATIONS_PREFIX } from '@/config/api';
import { ApiResponse, Notification, NotificationPreferences, NotificationType } from '@/types';

const N = API_NOTIFICATIONS_PREFIX; // '/api'

const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'ORDER_CONFIRMED',
  'ORDER_RECEIVED',
  'ORDER_CANCELLED',
  'ORDER_EXPIRED',
  'ORDER_PICKUP_REMINDER',
  'PAYMENT_SUCCESSFUL',
  'PAYMENT_FAILED',
  'BANK_TRANSFER_INITIATED',
  'BANK_TRANSFER_CONFIRMED',
  'BANKING_MODEL_CHANGED',
  'SYSTEM_ALERT',
];

type PreferencesUpdateBody = Pick<
  NotificationPreferences,
  'pushEnabled' | 'emailEnabled' | 'smsEnabled' | 'enabledTypes'
>;

function normalizePreferences(raw: unknown): NotificationPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const enabledTypes = Array.isArray(p.enabledTypes)
    ? (p.enabledTypes as unknown[]).filter((t): t is NotificationType =>
        typeof t === 'string' && ALL_NOTIFICATION_TYPES.includes(t as NotificationType),
      )
    : [];
  return {
    id: typeof p.id === 'number' ? p.id : undefined,
    userId: typeof p.userId === 'string' ? p.userId : undefined,
    pushEnabled: p.pushEnabled !== false,
    emailEnabled: p.emailEnabled === true,
    smsEnabled: p.smsEnabled === true,
    enabledTypes,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : undefined,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : undefined,
  };
}

function toPreferencesUpdateBody(prefs: NotificationPreferences): PreferencesUpdateBody {
  const enabledTypes = Array.isArray(prefs.enabledTypes)
    ? [...new Set(
        prefs.enabledTypes.filter((t): t is NotificationType =>
          ALL_NOTIFICATION_TYPES.includes(t),
        ),
      )]
    : [];
  return {
    pushEnabled: prefs.pushEnabled !== false,
    emailEnabled: prefs.emailEnabled === true,
    smsEnabled: prefs.smsEnabled === true,
    enabledTypes,
  };
}

function unwrapPreferencesResponse(payload: unknown): NotificationPreferences {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const wrapped = payload as ApiResponse<NotificationPreferences | null>;
    if (!wrapped.success) {
      throw new Error(wrapped.message ?? 'preferencesSaveFailed');
    }
    const normalized = normalizePreferences(wrapped.data);
    if (!normalized) throw new Error('preferencesSaveFailed');
    return normalized;
  }
  const normalized = normalizePreferences(payload);
  if (!normalized) throw new Error('preferencesSaveFailed');
  return normalized;
}

/**
 * Notification endpoints use the /api prefix and return the standard
 * { success, message, data, error } wrapper. All list/object responses
 * must unwrap via response.data.data.
 */

export async function registerFCMToken(token: string): Promise<void> {
  await apiClient.post(`${N}/notifications/fcm-token/register`, undefined, {
    params: { token },
  });
}

export async function removeFCMToken(): Promise<void> {
  await apiClient.delete(`${N}/notifications/fcm-token`);
}

export async function getNotifications(): Promise<Notification[]> {
  const response = await apiClient.get<ApiResponse<Notification[]>>(
    `${N}/notifications/user`,
  );
  const payload = response.data;
  // Handle both wrapped ({ success, data: [...] }) and unwrapped ([...]) responses
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function getUnreadNotifications(): Promise<Notification[]> {
  const response = await apiClient.get<ApiResponse<Notification[]>>(
    `${N}/notifications/user/unread`,
  );
  const payload = response.data;
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function markAsRead(notificationId: string): Promise<void> {
  await apiClient.post(`${N}/notifications/mark-read/${notificationId}`);
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.post(`${N}/notifications/mark-all-read`);
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await apiClient.delete(`${N}/notifications/${notificationId}`);
}

export async function getPreferences(): Promise<NotificationPreferences | null> {
  const response = await apiClient.get<ApiResponse<NotificationPreferences | null>>(
    `${N}/notifications/preferences`,
  );
  const payload = response.data;
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const data = (payload as ApiResponse<NotificationPreferences | null>).data;
    return data != null ? normalizePreferences(data) : null;
  }
  return normalizePreferences(payload);
}

export async function updatePreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const response = await apiClient.post<ApiResponse<NotificationPreferences>>(
    `${N}/notifications/preferences`,
    toPreferencesUpdateBody(prefs),
  );
  return unwrapPreferencesResponse(response.data);
}

export async function sendTestNotification(): Promise<void> {
  await apiClient.post(`${N}/notifications/test`);
}
