import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { colors } from '@/theme/colors';
import { NotificationPreferences, NotificationType } from '@/types';

// ── Per-type toggle definitions (role-filtered) ───────────────────────────────

type TypeToggle = { type: NotificationType; labelKey: string };

const CUSTOMER_TYPES: TypeToggle[] = [
  { type: 'ORDER_CONFIRMED', labelKey: 'notifications.orderConfirmed' },
  { type: 'ORDER_CANCELLED', labelKey: 'notifications.orderCancelled' },
  { type: 'ORDER_EXPIRED', labelKey: 'notifications.orderExpired' },
  { type: 'ORDER_PICKUP_REMINDER', labelKey: 'notifications.pickupReminder' },
  { type: 'PAYMENT_SUCCESSFUL', labelKey: 'notifications.paymentSuccessful' },
  { type: 'PAYMENT_FAILED', labelKey: 'notifications.paymentFailed' },
  { type: 'BANK_TRANSFER_INITIATED', labelKey: 'notifications.bankTransferInitiated' },
  { type: 'BANK_TRANSFER_CONFIRMED', labelKey: 'notifications.bankTransferConfirmed' },
];

const VENDOR_TYPES: TypeToggle[] = [
  { type: 'ORDER_RECEIVED', labelKey: 'notifications.orderReceived' },
  { type: 'ORDER_CANCELLED', labelKey: 'notifications.orderCancelled' },
  { type: 'BANKING_MODEL_CHANGED', labelKey: 'notifications.bankingModelChanged' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultPrefs(): NotificationPreferences {
  return {
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
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="px-4 pt-5 pb-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
      {label}
    </Text>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
  icon,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View
      className={`flex-row items-center px-4 py-3 bg-surface border-b border-border ${disabled ? 'opacity-40' : ''}`}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={colors.text.secondary}
          style={{ marginRight: 12 }}
        />
      )}
      <View className="flex-1 mr-3">
        <Text className="text-base text-text-primary font-medium">{label}</Text>
        {description && (
          <Text className="text-xs text-text-secondary mt-0.5">{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onValueChange}
        trackColor={{ false: colors.border, true: colors.primary.DEFAULT }}
        thumbColor={colors.surface}
        disabled={disabled}
      />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const user = useAuthStore((s) => s.user);
  const isVendor = user?.role === 'VENDOR' || user?.role === 'VENDOR_ADMIN';

  const fetchPreferences = useNotificationStore((s) => s.fetchPreferences);
  const updateNotificationPreferences = useNotificationStore((s) => s.updateNotificationPreferences);
  const storedPrefs = useNotificationStore((s) => s.preferences);

  const [isLoading, setIsLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreferences>(buildDefaultPrefs());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load preferences on focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setIsLoading(true);
        await fetchPreferences();
        if (active) setIsLoading(false);
      };
      load();
      return () => { active = false; };
    }, [fetchPreferences]),
  );

  // Sync store → local state whenever preferences load or save completes
  useEffect(() => {
    if (storedPrefs) setPrefs(storedPrefs);
  }, [storedPrefs]);

  const saveDebounced = useCallback(
    (updated: NotificationPreferences) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await updateNotificationPreferences(updated);
        } catch {
          Alert.alert(t('common.error'), t('notifications.preferencesSaveFailed'));
        }
      }, 500);
    },
    [updateNotificationPreferences, t],
  );

  const togglePush = useCallback(
    (value: boolean) => {
      setPrefs((current) => {
        const updated = { ...current, pushEnabled: value };
        saveDebounced(updated);
        return updated;
      });
    },
    [saveDebounced],
  );

  const toggleType = useCallback(
    (type: NotificationType, enabled: boolean) => {
      setPrefs((current) => {
        const updatedTypes = enabled
          ? current.enabledTypes.includes(type)
            ? current.enabledTypes
            : [...current.enabledTypes, type]
          : current.enabledTypes.filter((t) => t !== type);
        const updated = { ...current, enabledTypes: updatedTypes };
        saveDebounced(updated);
        return updated;
      });
    },
    [saveDebounced],
  );

  const typeToggles = isVendor ? VENDOR_TYPES : CUSTOMER_TYPES;
  const typesDisabled = !prefs.pushEnabled;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-3 bg-background border-b border-border"
        style={{ paddingTop: insets.top + 12 }}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="flex-1 text-xl font-bold text-primary mx-3">
          {t('notifications.preferences')}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Push master toggle */}
          <SectionLabel label={t('notifications.pushEnabled')} />
          <View className="mx-4 rounded-[14px] overflow-hidden bg-surface border border-border mb-2">
            <ToggleRow
              icon="notifications-outline"
              label={t('notifications.pushEnabled')}
              description={t('notifications.pushEnabledDesc')}
              value={prefs.pushEnabled}
              onValueChange={togglePush}
            />
          </View>

          {/* Per-type toggles */}
          <SectionLabel label={t('notifications.notificationTypes')} />
          <View
            className="mx-4 rounded-[14px] overflow-hidden bg-surface border border-border mb-2"
            style={{ opacity: typesDisabled ? 0.5 : 1 }}
          >
            {typeToggles.map(({ type, labelKey }) => (
              <ToggleRow
                key={type}
                label={t(labelKey)}
                value={prefs.enabledTypes.includes(type)}
                onValueChange={(v) => toggleType(type, v)}
                disabled={typesDisabled}
              />
            ))}
          </View>

          {/* Email note */}
          <View className="mx-4 mt-2 px-4 py-3 bg-surface rounded-[14px] border border-border">
            <Text className="text-xs text-text-secondary leading-5">
              {t('notifications.emailNote')}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
