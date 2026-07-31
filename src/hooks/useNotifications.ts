import { useNotificationStore } from '@/stores/notificationStore';

export function useNotifications() {
  const {
    unreadCount,
    notifications,
    isLoadingNotifications,
    preferences,
    registerFCMToken,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    deleteNotificationItem,
    fetchPreferences,
    updateNotificationPreferences,
    setPreferences,
  } = useNotificationStore();

  return {
    unreadCount,
    notifications,
    isLoadingNotifications,
    preferences,
    registerFCMToken,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    deleteNotificationItem,
    fetchPreferences,
    updateNotificationPreferences,
    setPreferences,
  };
}
