import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { navigationRef } from '@/navigation/navigationRef';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

// Configure how notifications are presented when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Reads the notification data payload and navigates to the appropriate screen.
 * Uses `data.type` when the backend includes it; otherwise falls back to key-based routing.
 * Mirrors the type-aware routing table in NotificationScreen → useNotificationNavigation.
 */
function routeToNotificationTarget(data: Record<string, string> | undefined): void {
  if (!data || !navigationRef.isReady()) return;
  if ('test' in data) return;

  const user = useAuthStore.getState().user;
  const isVendor = user?.role === 'VENDOR' || user?.role === 'VENDOR_ADMIN';
  const type = data.type as string | undefined;
  const orderId = data.orderId ?? data.requestId;

  if (isVendor) {
    switch (type) {
      case 'ORDER_RECEIVED':
      case 'ORDER_CONFIRMED':
      case 'ORDER_CANCELLED':
      case 'ORDER_EXPIRED':
      case 'ORDER_PICKUP_REMINDER':
        if (orderId) {
          navigationRef.navigate('VendorStack', {
            screen: 'VendorOrderDetail',
            params: { orderId },
          });
        } else {
          navigationRef.navigate('VendorStack', {
            screen: 'VendorTabs',
            params: { screen: 'VendorDashboard' },
          });
        }
        break;
      case 'PAYMENT_SUCCESSFUL':
      case 'PAYMENT_FAILED':
        navigationRef.navigate('VendorStack', { screen: 'VendorPaymentSettings' });
        break;
      case 'BANK_TRANSFER_INITIATED':
      case 'BANK_TRANSFER_CONFIRMED':
        navigationRef.navigate('VendorStack', { screen: 'VendorBankAccounts' });
        break;
      case 'BANKING_MODEL_CHANGED':
        // Headquarters-only screen; branches refresh via dashboard.
        navigationRef.navigate('VendorStack', {
          screen: 'VendorTabs',
          params: { screen: 'VendorDashboard' },
        });
        break;
      default:
        // No type in payload — fall back to key-based routing
        if (data.chainId) {
          navigationRef.navigate('VendorStack', {
            screen: 'VendorTabs',
            params: { screen: 'VendorDashboard' },
          });
        } else if (orderId) {
          navigationRef.navigate('VendorStack', {
            screen: 'VendorOrderDetail',
            params: { orderId },
          });
        }
    }
  } else {
    switch (type) {
      case 'ORDER_CONFIRMED':
      case 'ORDER_CANCELLED':
      case 'ORDER_EXPIRED':
      case 'ORDER_PICKUP_REMINDER':
      case 'PAYMENT_SUCCESSFUL':
      case 'PAYMENT_FAILED':
        if (orderId) {
          navigationRef.navigate('CustomerStack', {
            screen: 'OrderDetail',
            params: { orderId },
          });
        } else {
          navigationRef.navigate('CustomerStack', {
            screen: 'CustomerTabs',
            params: { screen: 'Orders' },
          });
        }
        break;
      case 'BANK_TRANSFER_INITIATED':
      case 'BANK_TRANSFER_CONFIRMED':
        navigationRef.navigate('CustomerStack', { screen: 'PaymentMethods' });
        break;
      default:
        // No type in payload — fall back to key-based routing
        if (orderId) {
          navigationRef.navigate('CustomerStack', {
            screen: 'OrderDetail',
            params: { orderId },
          });
        }
    }
  }
}

/**
 * Non-rendering component that handles the full FCM lifecycle:
 * 1. Requests push notification permissions
 * 2. Registers the device FCM token with the backend
 * 3. Re-registers on token rotation (addPushTokenListener)
 * 4. Fetches unread count after login
 * 5. Increments unread count on foreground push
 * 6. Routes to the correct screen when a notification is tapped
 */
export default function NotificationInitializer() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const tokenListenerRef = useRef<Notifications.EventSubscription | undefined>(undefined);
  const foregroundSubRef = useRef<Notifications.EventSubscription | undefined>(undefined);
  const tapSubRef = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated) {
      tokenListenerRef.current?.remove();
      foregroundSubRef.current?.remove();
      tapSubRef.current?.remove();
      return;
    }

    const { registerFCMToken, fetchNotifications, incrementUnreadCount } =
      useNotificationStore.getState();

    const setup = async () => {
      // Always load the full notification list on login — this also sets unreadCount
      // so the badge is populated correctly regardless of push permission status.
      fetchNotifications().catch(() => {});

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        // Small delay to ensure Firebase native layer is ready
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Get the raw device token (FCM on Android, APN on iOS)
        const tokenData = await Notifications.getDevicePushTokenAsync();
        await registerFCMToken(tokenData.data);

        // Re-register on token rotation
        tokenListenerRef.current = Notifications.addPushTokenListener((token) => {
          registerFCMToken(token.data);
        });
      } catch {
        // Non-fatal: app still works without push notifications
      }

      // Foreground push: increment badge (will also trigger the system notification via handler above)
      foregroundSubRef.current = Notifications.addNotificationReceivedListener(() => {
        incrementUnreadCount();
      });

      // Notification tap: route based on data payload
      tapSubRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        routeToNotificationTarget(data);
      });

      // Handle tap from killed state (app opened via notification)
      if (Platform.OS === 'android') {
        Notifications.getLastNotificationResponseAsync().then((response) => {
          if (response) {
            const data = response.notification.request.content.data as Record<string, string> | undefined;
            // Use a small delay to let the nav container mount
            setTimeout(() => routeToNotificationTarget(data), 1000);
          }
        }).catch(() => {});
      }
    };

    setup();

    return () => {
      tokenListenerRef.current?.remove();
      foregroundSubRef.current?.remove();
      tapSubRef.current?.remove();
    };
  }, [isAuthenticated]);

  return null;
}
