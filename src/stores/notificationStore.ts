import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  getNotifications,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
  registerFCMToken as serviceRegisterFCMToken,
} from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';
import { Notification, NotificationPreferences } from '@/types';

// ── Persisted read-state helpers ──────────────────────────────────────────────

const readIdsKey = (userId: string) => `@stillfresh_read_ids_${userId}`;

async function loadPersistedReadIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(readIdsKey(userId));
    if (raw) return new Set<string>(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set<string>();
}

async function savePersistedReadIds(userId: string, ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(readIdsKey(userId), JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

interface NotificationState {
  fcmToken: string | null;
  unreadCount: number;
  notifications: Notification[];
  isLoadingNotifications: boolean;
  preferences: NotificationPreferences | null;
}

interface NotificationActions {
  registerFCMToken: (token: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotificationItem: (id: string) => Promise<void>;
  fetchPreferences: () => Promise<void>;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<void>;
  incrementUnreadCount: () => void;
  setUnreadCount: (count: number) => void;
  resetUnreadCount: () => void;
  setPreferences: (prefs: NotificationPreferences) => void;
  clearFCMRegistration: () => void;
}

const ALL_TYPES_ENABLED: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: false,
  smsEnabled: false,
  enabledTypes: [
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
  ],
};

export const useNotificationStore = create<NotificationState & NotificationActions>((set, get) => ({
  fcmToken: null,
  unreadCount: 0,
  notifications: [],
  isLoadingNotifications: false,
  preferences: null,

  registerFCMToken: async (token) => {
    set({ fcmToken: token });
    try {
      await serviceRegisterFCMToken(token);
    } catch {
      // Non-fatal: app still works without push notifications
    }
  },

  fetchNotifications: async () => {
    set({ isLoadingNotifications: true });
    try {
      const result = await getNotifications();
      const fresh = Array.isArray(result) ? result : [];

      const rawUserId = useAuthStore.getState().user?.id;
      const userId = rawUserId != null ? String(rawUserId) : '';

      // Three-source merge:
      //  1. Server data  (isRead field as returned)
      //  2. In-memory    (notifications already in the store, marked during this session)
      //  3. Persisted    (AsyncStorage – survives logout/login)
      // A notification stays read once any source marks it read.
      const localNotifications = get().notifications;
      const localReadIds = new Set(
        localNotifications.filter((n) => n.isRead).map((n) => n.id),
      );
      const persistedReadIds = userId
        ? await loadPersistedReadIds(userId)
        : new Set<string>();

      const allReadIds = new Set([...localReadIds, ...persistedReadIds]);

      const merged = fresh.map((n) =>
        allReadIds.has(n.id) ? { ...n, isRead: true } : n,
      );

      set({
        notifications: merged,
        unreadCount: merged.filter((n) => !n.isRead).length,
      });

      // Persist updated read IDs, pruning any that are no longer in the list
      if (userId) {
        const currentIds = new Set(fresh.map((n) => n.id));
        const readIdsInCurrentList = new Set(
          [...allReadIds].filter((id) => currentIds.has(id)),
        );
        // Also absorb any that the server itself returned as read
        fresh.filter((n) => n.isRead).forEach((n) => readIdsInCurrentList.add(n.id));
        await savePersistedReadIds(userId, readIdsInCurrentList);
      }
    } catch {
      // Keep stale list on error
    } finally {
      set({ isLoadingNotifications: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const raw = await getUnreadNotifications();
      // Handle various API response shapes robustly
      if (Array.isArray(raw)) {
        set({ unreadCount: raw.length });
        return;
      }
      // Some backends return { success, data: <number> }
      const asAny = raw as unknown as Record<string, unknown>;
      if (typeof asAny?.data === 'number') {
        set({ unreadCount: asAny.data });
        return;
      }
      // { success, data: [...] } already unwrapped in service but just in case
      if (Array.isArray(asAny?.data)) {
        set({ unreadCount: (asAny.data as unknown[]).length });
        return;
      }
    } catch {
      // Fall through to local fallback
    }
    // Fallback: count from the local notifications list we already have
    const { notifications } = get();
    if (Array.isArray(notifications)) {
      set({ unreadCount: notifications.filter((n) => !n.isRead).length });
    }
  },

  markRead: async (id) => {
    const wasAlreadyRead = get().notifications.find((n) => n.id === id)?.isRead ?? true;
    // Optimistically update local state
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - (wasAlreadyRead ? 0 : 1)),
    }));
    try {
      await markAsRead(id);
      // Persist so the read state survives logout/login
      const rawUserId = useAuthStore.getState().user?.id;
      const userId = rawUserId != null ? String(rawUserId) : '';
      if (userId) {
        const persisted = await loadPersistedReadIds(userId);
        persisted.add(id);
        await savePersistedReadIds(userId, persisted);
      }
    } catch {
      // Revert optimistic update on failure
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: false } : n,
        ),
        unreadCount: state.unreadCount + (wasAlreadyRead ? 0 : 1),
      }));
    }
  },

  markAllRead: async () => {
    const prevNotifications = get().notifications;
    const allIds = get().notifications.map((n) => n.id);
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
    try {
      await markAllAsRead();
      // Persist all IDs as read so the state survives logout/login
      const rawUserId = useAuthStore.getState().user?.id;
      const userId = rawUserId != null ? String(rawUserId) : '';
      if (userId) {
        const persisted = await loadPersistedReadIds(userId);
        allIds.forEach((id) => persisted.add(id));
        await savePersistedReadIds(userId, persisted);
      }
    } catch {
      set({ notifications: prevNotifications });
      await get().fetchUnreadCount();
    }
  },

  deleteNotificationItem: async (id) => {
    const prev = get().notifications;
    const wasUnread = prev.find((n) => n.id === id)?.isRead === false;
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
    try {
      await deleteNotification(id);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status !== 400) {
        // 400 = already gone; only revert on unexpected errors
        set({ notifications: prev });
        if (wasUnread) await get().fetchUnreadCount();
      }
    }
  },

  fetchPreferences: async () => {
    try {
      const prefs = await getPreferences();
      set({ preferences: prefs ?? ALL_TYPES_ENABLED });
    } catch {
      set({ preferences: ALL_TYPES_ENABLED });
    }
  },

  updateNotificationPreferences: async (prefs) => {
    const prev = get().preferences;
    set({ preferences: prefs });
    try {
      const saved = await updatePreferences(prefs);
      set({ preferences: saved });
    } catch {
      set({ preferences: prev });
      throw new Error('preferencesSaveFailed');
    }
  },

  incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

  setUnreadCount: (count) => set({ unreadCount: count }),

  resetUnreadCount: () => set({ unreadCount: 0, notifications: [], fcmToken: null }),

  setPreferences: (prefs) => set({ preferences: prefs }),

  clearFCMRegistration: () => set({ fcmToken: null }),
}));
