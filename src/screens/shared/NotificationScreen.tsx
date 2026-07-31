import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/stores/authStore';
import BackButton from '@/components/BackButton';
import { useNotificationStore } from '@/stores/notificationStore';
import { colors } from '@/theme/colors';
import { Notification, NotificationType } from '@/types';
import { formatNotificationContent } from '@/utils/formatNotificationContent';
import { formatRelativeTime } from '@/utils/formatDate';

// ── Type icon config ──────────────────────────────────────────────────────────

type IconConfig = {
  name: React.ComponentProps<typeof Ionicons>['name'];
  bg: string;
  tint: string;
};

const TYPE_ICON: Record<NotificationType, IconConfig> = {
  ORDER_CONFIRMED: { name: 'checkmark-circle', bg: colors.primary[100], tint: colors.primary.DEFAULT },
  ORDER_RECEIVED: { name: 'receipt-outline', bg: colors.primary[100], tint: colors.primary.DEFAULT },
  ORDER_CANCELLED: { name: 'close-circle', bg: '#FEECEC', tint: colors.error },
  ORDER_EXPIRED: { name: 'time-outline', bg: '#FFF4E5', tint: colors.warning },
  ORDER_PICKUP_REMINDER: { name: 'alarm-outline', bg: '#FFF4E5', tint: colors.warning },
  PAYMENT_SUCCESSFUL: { name: 'card', bg: colors.primary[100], tint: colors.primary.DEFAULT },
  PAYMENT_FAILED: { name: 'card-outline', bg: '#FEECEC', tint: colors.error },
  BANK_TRANSFER_INITIATED: { name: 'swap-horizontal-outline', bg: colors.primary[50], tint: colors.primary.DEFAULT },
  BANK_TRANSFER_CONFIRMED: { name: 'checkmark-circle', bg: colors.primary[100], tint: colors.primary.DEFAULT },
  BANKING_MODEL_CHANGED: { name: 'settings-outline', bg: colors.primary[50], tint: colors.primary.DEFAULT },
  SYSTEM_ALERT: { name: 'alert-circle-outline', bg: '#FFF4E5', tint: colors.warning },
};

const DEFAULT_ICON: IconConfig = {
  name: 'notifications-outline',
  bg: colors.primary[50],
  tint: colors.primary.DEFAULT,
};

// ── Notification routing ──────────────────────────────────────────────────────

function useNotificationNavigation() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const isVendor = user?.role === 'VENDOR' || user?.role === 'VENDOR_ADMIN';

  return useCallback(
    (notification: Notification) => {
      const { type, data = {} } = notification;
      const orderId = data.orderId ?? data.requestId;

      if (isVendor) {
        switch (type) {
          case 'ORDER_RECEIVED':
          case 'ORDER_CONFIRMED':
          case 'ORDER_CANCELLED':
          case 'ORDER_EXPIRED':
          case 'ORDER_PICKUP_REMINDER':
            if (orderId) {
              navigation.navigate('VendorOrderDetail', { orderId });
            } else {
              navigation.navigate('VendorTabs', { screen: 'VendorDashboard' });
            }
            break;
          case 'PAYMENT_SUCCESSFUL':
          case 'PAYMENT_FAILED':
            navigation.navigate('VendorPaymentSettings');
            break;
          case 'BANK_TRANSFER_INITIATED':
          case 'BANK_TRANSFER_CONFIRMED':
            navigation.navigate('VendorBankAccounts');
            break;
          case 'BANKING_MODEL_CHANGED':
            // Only HQ manages the banking model; branches just land on the dashboard.
            navigation.navigate('VendorTabs', { screen: 'VendorDashboard' });
            break;
          default:
            navigation.navigate('VendorTabs', { screen: 'VendorDashboard' });
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
              navigation.navigate('OrderDetail', { orderId });
            } else {
              navigation.navigate('CustomerTabs', { screen: 'Orders' });
            }
            break;
          case 'BANK_TRANSFER_INITIATED':
          case 'BANK_TRANSFER_CONFIRMED':
            navigation.navigate('PaymentMethods');
            break;
          default:
            break;
        }
      }
    },
    [navigation, isVendor],
  );
}

// ── Delete action (swipe-right panel) ─────────────────────────────────────────

function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-error justify-center items-center px-6"
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );
}

// ── Single notification row ───────────────────────────────────────────────────

type NotificationRowProps = {
  item: Notification;
  onTap: (notification: Notification) => void;
  onDelete: (id: string) => void;
};

function NotificationRow({ item, onTap, onDelete }: NotificationRowProps) {
  const { t } = useTranslation();
  const swipeRef = useRef<Swipeable>(null);
  const icon = TYPE_ICON[item.type] ?? DEFAULT_ICON;
  const { title, message } = formatNotificationContent(item, t);

  const handleDelete = () => {
    swipeRef.current?.close();
    onDelete(item.id);
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => <DeleteAction onPress={handleDelete} />}
      overshootRight={false}
    >
      <TouchableOpacity
        onPress={() => onTap(item)}
        activeOpacity={0.7}
        style={{ backgroundColor: item.isRead ? colors.surface : colors.primary[50] }}
        className="flex-row items-start px-4 py-3 border-b border-border"
      >
        {/* Type icon */}
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3 mt-0.5"
          style={{ backgroundColor: icon.bg }}
        >
          <Ionicons name={icon.name} size={20} color={icon.tint} />
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text
            className={`text-sm text-text-primary mb-0.5 ${item.isRead ? 'font-medium' : 'font-semibold'}`}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text className="text-xs text-text-secondary leading-4" numberOfLines={2}>
            {message}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">
            {formatRelativeTime(item.createdAt, t)}
          </Text>
        </View>

        {/* Unread dot */}
        {!item.isRead && (
          <View className="w-2 h-2 rounded-full bg-primary mt-1.5 ml-2" />
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Ionicons name="notifications-outline" size={56} color={colors.primary[200]} />
      <Text className="text-base font-semibold text-text-primary text-center mt-4 mb-2">
        {t('notifications.empty')}
      </Text>
      <Text className="text-sm text-text-secondary text-center">
        {t('notifications.emptyDesc')}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const notifications = useNotificationStore((s) => s.notifications);
  const isLoading = useNotificationStore((s) => s.isLoadingNotifications);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const deleteNotificationItem = useNotificationStore((s) => s.deleteNotificationItem);

  const routeToNotification = useNotificationNavigation();
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const handleTap = useCallback(
    async (notification: Notification) => {
      if (!notification.isRead) {
        await markRead(notification.id);
      }
      routeToNotification(notification);
    },
    [markRead, routeToNotification],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteNotificationItem(id);
      } catch {
        Alert.alert(t('common.error'), t('notifications.deleteFailed'));
      }
    },
    [deleteNotificationItem, t],
  );

  const handleMarkAll = useCallback(async () => {
    try {
      await markAllRead();
    } catch {
      Alert.alert(t('common.error'), t('notifications.markReadFailed'));
    }
  }, [markAllRead, t]);

  const hasUnread = safeNotifications.some((n) => !n.isRead);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-3 bg-surface border-b border-border"
        style={{ paddingTop: insets.top + 12 }}
      >
        <BackButton onPress={() => navigation.goBack()} />

        <Text className="flex-1 text-xl font-bold text-text-primary mx-3">
          {t('notifications.title')}
        </Text>

        {hasUnread && (
          <TouchableOpacity
            onPress={handleMarkAll}
            activeOpacity={0.7}
            className="mr-2"
            hitSlop={8}
          >
            <Text className="text-sm font-semibold text-primary">
              {t('notifications.markAllRead')}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationPreferences')}
          className="w-9 h-9 rounded-full bg-background items-center justify-center"
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {isLoading && safeNotifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <FlatList
          data={safeNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow item={item} onTap={handleTap} onDelete={handleDelete} />
          )}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && safeNotifications.length > 0}
              onRefresh={fetchNotifications}
              tintColor={colors.primary.DEFAULT}
              colors={[colors.primary.DEFAULT]}
            />
          }
          contentContainerStyle={
            safeNotifications.length === 0 ? { flex: 1 } : { paddingBottom: insets.bottom + 16 }
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
