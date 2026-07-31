import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileFieldEditModal, {
  ProfileFieldEditorConfig,
} from '@/components/ProfileFieldEditModal';
import { ProfileFieldKey, useCustomerProfile } from '@/hooks/useCustomerProfile';
import { CustomerTabScreenProps } from '@/navigation/types';
import { useAuthStore } from '@/stores/authStore';
import { User } from '@/types';
import { colors } from '@/theme/colors';
import { formatDate } from '@/utils/formatDate';
import { getUserDisplayName, getUserInitials, isProfileIncomplete } from '@/utils/userHelpers';

type Props = CustomerTabScreenProps<'CustomerProfile'>;

type ShortcutItem = {
  labelKey: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
};

function displayValue(value: string | null | undefined, notSetLabel: string): string {
  if (value == null || value.trim() === '') return notSetLabel;
  return value.trim();
}

function getFieldValue(user: User, field: ProfileFieldKey, notSetLabel: string): string {
  switch (field) {
    case 'name': {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      return displayValue(name, notSetLabel);
    }
    case 'phone':
      return displayValue(user.phoneNumber ?? user.phone, notSetLabel);
    case 'address':
      return displayValue(user.address, notSetLabel);
    case 'country':
      return displayValue(user.country ?? user.countryCode, notSetLabel);
    case 'birthday':
      return user.birthday?.trim()
        ? formatDate(user.birthday.trim(), 'sr')
        : notSetLabel;
    case 'dietaryPreference':
      return displayValue(user.dietaryPreference, notSetLabel);
    default:
      return notSetLabel;
  }
}

export default function CustomerProfileScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    profile,
    isLoading,
    isRefreshing,
    error,
    savingField,
    loadProfile,
    refreshProfile,
    updateField,
    clearError,
  } = useCustomerProfile();

  const logout = useAuthStore((s) => s.logout);

  const [editorConfig, setEditorConfig] = useState<ProfileFieldEditorConfig | null>(null);
  const [completionBannerDismissed, setCompletionBannerDismissed] = useState(false);

  const notSetLabel = t('customer.profile.notSet');
  const loadProfileRef = useRef(loadProfile);
  loadProfileRef.current = loadProfile;

  useFocusEffect(
    useCallback(() => {
      void loadProfileRef.current();
    }, []),
  );

  const openEditor = (field: ProfileFieldKey) => {
    if (profile == null) return;

    if (field === 'name') {
      setEditorConfig({
        field: 'name',
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
      });
      return;
    }

    const valueMap: Record<Exclude<ProfileFieldKey, 'name'>, string> = {
      phone: profile.phoneNumber ?? profile.phone ?? '',
      address: profile.address ?? '',
      country: profile.country ?? profile.countryCode ?? '',
      birthday: profile.birthday ?? '',
      dietaryPreference: profile.dietaryPreference ?? '',
    };

    setEditorConfig({ field, value: valueMap[field] });
  };

  const handleSave = async (field: ProfileFieldKey, values: Record<string, string>) => {
    const success = await updateField(field, values);
    if (success) {
      setEditorConfig(null);
      return;
    }

    Alert.alert(t('common.error'), t('errors.serverError'));
  };

  const onLogout = () => {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const showCompletionBanner =
    profile != null &&
    isProfileIncomplete(profile) &&
    !completionBannerDismissed;

  const shortcuts: ShortcutItem[] = [
    {
      labelKey: 'customer.favourites',
      icon: 'heart-outline',
      onPress: () => navigation.navigate('Favorites'),
    },
    {
      labelKey: 'customer.paymentMethods',
      icon: 'card-outline',
      onPress: () => navigation.navigate('PaymentMethods'),
    },
    {
      labelKey: 'customer.orderHistory',
      icon: 'receipt-outline',
      onPress: () => navigation.navigate('OrderHistory'),
    },
    {
      labelKey: 'customer.profile.settings',
      icon: 'settings-outline',
      onPress: () => navigation.navigate('CustomerSettings'),
    },
  ];

  const profileRows: Array<{
    field: ProfileFieldKey | 'email';
    labelKey: string;
    icon: ComponentProps<typeof Ionicons>['name'];
    editable: boolean;
  }> = [
    { field: 'email', labelKey: 'auth.email', icon: 'mail-outline', editable: false },
    { field: 'name', labelKey: 'customer.profile.name', icon: 'person-outline', editable: true },
    { field: 'phone', labelKey: 'customer.profile.phone', icon: 'call-outline', editable: true },
    {
      field: 'address',
      labelKey: 'customer.profile.address',
      icon: 'location-outline',
      editable: true,
    },
    {
      field: 'country',
      labelKey: 'customer.profile.country',
      icon: 'globe-outline',
      editable: true,
    },
    {
      field: 'birthday',
      labelKey: 'customer.profile.birthday',
      icon: 'calendar-outline',
      editable: true,
    },
    {
      field: 'dietaryPreference',
      labelKey: 'customer.profile.dietaryPreference',
      icon: 'leaf-outline',
      editable: true,
    },
  ];

  if (isLoading && profile == null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const displayName = profile != null ? getUserDisplayName(profile) : '';
  const initials = profile != null ? getUserInitials(profile) : '';
  const username = profile?.username?.trim();

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refreshProfile()}
            tintColor={colors.primary.DEFAULT}
          />
        }
      >
        <View style={{ paddingTop: insets.top + 12 }} className="px-4 pb-2">
          <Text className="text-2xl font-bold text-text-primary">{t('navigation.profile')}</Text>
        </View>

        {error != null && (
          <View className="mx-4 mb-4 bg-surface border border-error rounded-xl px-4 py-3 flex-row items-center">
            <Text className="flex-1 text-sm text-error">{t(error)}</Text>
            <TouchableOpacity onPress={() => { clearError(); void loadProfile(); }} hitSlop={8}>
              <Text className="text-primary text-sm font-semibold">{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showCompletionBanner && (
          <View className="mx-4 mb-4 bg-primary-50 border border-primary rounded-[14px] px-4 py-3">
            <View className="flex-row items-start">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-semibold text-text-primary">
                  {t('customer.profile.completionTitle')}
                </Text>
                <Text className="text-xs text-text-secondary mt-1">
                  {t('customer.profile.completionDesc')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCompletionBannerDismissed(true)}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View
          className="mx-4 mb-6 bg-surface rounded-[14px] px-4 py-5 items-center"
          style={CARD_SHADOW}
        >
          <View className="w-16 h-16 rounded-full bg-primary items-center justify-center mb-3">
            <Text className="text-xl font-bold text-white">{initials}</Text>
          </View>
          <Text className="text-lg font-bold text-text-primary text-center">{displayName}</Text>
          {username != null && username !== '' && (
            <Text className="text-sm text-text-secondary mt-1">@{username}</Text>
          )}
        </View>

        <SectionLabel label={t('customer.profile.sectionProfile')} />
        <View className="mx-4 mb-6 bg-surface rounded-[14px] overflow-hidden" style={CARD_SHADOW}>
          {profileRows.map((row, index) => {
            const displayText =
              row.field === 'email'
                ? displayValue(profile?.email, notSetLabel)
                : row.field === 'birthday' && profile?.birthday?.trim()
                  ? formatDate(profile.birthday.trim(), i18n.language)
                  : profile != null
                    ? getFieldValue(profile, row.field, notSetLabel)
                    : notSetLabel;

            if (!row.editable) {
              return (
                <ProfileInfoRow
                  key={row.field}
                  icon={row.icon}
                  label={t(row.labelKey)}
                  value={displayText}
                  isLast={index === profileRows.length - 1}
                />
              );
            }

            return (
              <ProfileEditableRow
                key={row.field}
                icon={row.icon}
                label={t(row.labelKey)}
                value={displayText}
                isLast={index === profileRows.length - 1}
                onPress={() => openEditor(row.field as ProfileFieldKey)}
              />
            );
          })}
        </View>

        <SectionLabel label={t('customer.profile.sectionShortcuts')} />
        <View className="mx-4 bg-surface rounded-[14px] overflow-hidden" style={CARD_SHADOW}>
          {shortcuts.map((item, index) => (
            <TouchableOpacity
              key={item.labelKey}
              onPress={item.onPress}
              className={`flex-row items-center px-4 py-4 ${
                index < shortcuts.length - 1 ? 'border-b border-border' : ''
              }`}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={22} color={colors.text.secondary} />
              <Text className="flex-1 text-base text-text-primary ml-3">{t(item.labelKey)}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          ))}
        </View>

        <View className="px-4 mt-8">
          <TouchableOpacity
            onPress={onLogout}
            className="bg-error rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">{t('auth.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ProfileFieldEditModal
        visible={editorConfig != null}
        config={editorConfig}
        isSaving={savingField != null}
        onClose={() => setEditorConfig(null)}
        onSave={(field, values) => void handleSave(field, values)}
      />
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="px-4 pb-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
      {label}
    </Text>
  );
}

function ProfileInfoRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-start px-4 py-3.5 ${isLast ? '' : 'border-b border-border'}`}
    >
      <Ionicons name={icon} size={20} color={colors.text.secondary} style={{ marginTop: 1 }} />
      <Text className="w-28 text-sm text-text-secondary ml-3">{label}</Text>
      <Text className="flex-1 text-sm text-text-primary">{value}</Text>
    </View>
  );
}

function ProfileEditableRow({
  icon,
  label,
  value,
  isLast,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  isLast?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-start px-4 py-3.5 ${isLast ? '' : 'border-b border-border'}`}
    >
      <Ionicons name={icon} size={20} color={colors.text.secondary} style={{ marginTop: 1 }} />
      <Text className="w-28 text-sm text-text-secondary ml-3">{label}</Text>
      <Text className="flex-1 text-sm text-text-primary">{value}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
    </TouchableOpacity>
  );
}
