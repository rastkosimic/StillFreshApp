import { Feather, Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
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

import AuthImage from '@/components/AuthImage';

import { LEGAL_URLS, openLegalUrl } from '@/config/legal';
import { VendorTabScreenProps } from '@/navigation/types';
import { deleteVendorAccount, getVendorProfile, VendorProfile } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { decodeJWTPayload } from '@/utils/jwtDecoder';

type Props = VendorTabScreenProps<'VendorProfile'>;

export default function VendorProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProfile = useCallback(async (silent = false) => {
    const token = useAuthStore.getState().token;
    if (user == null || token == null) {
      if (!silent) setIsLoading(false);
      return;
    }
    const payload = decodeJWTPayload(token);
    const vendorId = (payload?.userId as number | undefined) || user.id;
    if (!vendorId) {
      if (!silent) setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);
    await getVendorProfile(vendorId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => { if (!silent) setIsLoading(false); });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadProfile(true);
    setIsRefreshing(false);
  }, [loadProfile]);

  const email = profile?.email ?? user?.email ?? '';
  // Prefer the business identity fields; fall back to username, then email
  const displayName = profile?.locationName ?? profile?.chainName ?? profile?.username ?? email;
  const showEmailSubtitle = displayName !== email;
  // Initials from first letters of display name words, or first 2 chars of email
  const initials = displayName !== email
    ? displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const onLogout = () => {
    Alert.alert(
      t('auth.logout'),
      t('auth.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.logout'), style: 'destructive', onPress: () => void logout() },
      ],
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      t('vendor.profile.deleteAccountConfirmTitle'),
      t('vendor.profile.deleteAccountConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteVendorAccount();
              await logout();
            } catch {
              Alert.alert(t('common.error'), t('errors.serverError'));
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Page title */}
      <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 36 }} />
        <Text style={{ flex: 1, fontSize: 28, fontFamily: fonts.ui.bold, color: colors.primary.DEFAULT, textAlign: 'center' }}>
          {t('navigation.profile')}
        </Text>
        {user?.role === 'VENDOR_ADMIN' ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('VendorEditProfile')}
            activeOpacity={0.7}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Feather name="edit-2" size={16} color={colors.primary.DEFAULT} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Avatar / identity row */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 18,
        marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
      }}>
        {/* Avatar */}
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          overflow: 'hidden',
          backgroundColor: colors.primary.DEFAULT,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AuthImage
            uri={profile?.imageUrl}
            style={{ width: 56, height: 56 }}
            contentFit="cover"
            fallback={<Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{initials}</Text>}
          />
        </View>

        {/* Name / email */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>
              {displayName}
            </Text>
            {profile?.isHeadquarters && (
              <View style={{
                backgroundColor: colors.primary[50] ?? '#E8F5E9',
                borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary.DEFAULT }}>
                  {t('vendor.profile.headquarters')}
                </Text>
              </View>
            )}
          </View>
          {showEmailSubtitle && (
            <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2 }}>
              {email}
            </Text>
          )}
        </View>
      </View>

      {/* Business Info section */}
      <View style={{ marginTop: 28 }}>
        <SectionHeader label={t('vendor.profile.sectionBusiness')} />
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <InfoRow
            icon="reader-outline"
            label={t('vendor.profile.aboutBusiness')}
            value={profile?.aboutBusiness || '—'}
          />
          <InfoRow
            icon="storefront-outline"
            label={t('vendor.profile.businessType')}
            value={profile?.businessType
              ? t(`vendor.businessTypes.${profile.businessType}`, { defaultValue: profile.businessType })
              : '—'}
          />
          <InfoRow
            icon="leaf-outline"
            label={t('vendor.profile.surplusFood')}
            value={(profile?.surplusFoodDetails?.length ?? 0) > 0
              ? profile!.surplusFoodDetails!.map((k) => t(`vendor.foodTypes.${k}`, { defaultValue: k })).join(', ')
              : '—'}
          />
          <InfoRow
            icon="time-outline"
            label={t('vendor.profile.operatingHours')}
            value={(profile?.operatingHours?.length ?? 0) > 0
              ? profile!.operatingHours!.map((k) => t(`vendor.operatingDays.${k}`, { defaultValue: k })).join(', ')
              : '—'}
          />
        </View>
      </View>

      {/* Contact section */}
      <View style={{ marginTop: 28 }}>
        <SectionHeader label={t('vendor.profile.sectionContact')} />
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <InfoRow icon="person-outline" label={t('vendor.profile.contactPerson')} value={profile?.contactPerson || '—'} />
          <InfoRow icon="call-outline" label={t('vendor.profile.phone')} value={profile?.phone || '—'} />
          <InfoRow icon="location-outline" label={t('vendor.profile.address')} value={profile?.address || '—'} />
          <InfoRow icon="globe-outline" label={t('vendor.profile.country')} value={profile?.country || '—'} />
          <InfoRow icon="link-outline" label={t('vendor.profile.website')} value={profile?.website || '—'} />
        </View>
      </View>

      {/* Notifications section */}
      <View style={{ marginTop: 28 }}>
        <SectionHeader label={t('notifications.title')} />
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <SettingsRow
            icon="notifications-outline"
            label={t('notifications.preferences')}
            onPress={() => navigation.navigate('NotificationPreferences')}
            isLast
          />
        </View>
      </View>

      {/* Legal section */}
      <View style={{ marginTop: 28 }}>
        <SectionHeader label={t('legal.sectionTitle')} />
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t('legal.privacyPolicy')}
            onPress={() => void openLegalUrl(LEGAL_URLS.privacy)}
          />
          <SettingsRow
            icon="document-text-outline"
            label={t('legal.termsVendor')}
            onPress={() => void openLegalUrl(LEGAL_URLS.termsVendor)}
            isLast
          />
        </View>
      </View>

      {/* Account section */}
      <View style={{ marginTop: 28 }}>
        <SectionHeader label={t('vendor.profile.sectionAccount')} />
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <SettingsRow
            icon="lock-closed-outline"
            label={t('auth.changePassword')}
            onPress={() => navigation.navigate('VendorResetPassword')}
          />
          <SettingsRow
            icon="trash-outline"
            label={t('vendor.profile.deleteAccount')}
            onPress={onDeleteAccount}
            destructive
            isLast
            disabled={isDeleting}
          />
        </View>
      </View>

      {/* Log out */}
      <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
        <TouchableOpacity
          onPress={onLogout}
          className="bg-error rounded-xl py-4 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">
            {t('auth.logout')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={{
      fontSize: 12, fontWeight: '600', color: colors.text.secondary,
      textTransform: 'uppercase', letterSpacing: 0.6,
      paddingHorizontal: 20, paddingBottom: 6,
    }}>
      {label}
    </Text>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
    }}>
      <Ionicons name={icon} size={18} color={colors.text.secondary} style={{ marginTop: 1 }} />
      <Text style={{ fontSize: 14, color: colors.text.secondary, width: 100 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: colors.text.primary }}>{value}</Text>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  destructive,
  isLast,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
  isLast?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#F2F2F7',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={destructive ? colors.error : colors.text.secondary} />
      <Text style={{ flex: 1, fontSize: 15, color: destructive ? colors.error : colors.text.primary }}>
        {label}
      </Text>
      {!destructive && <Ionicons name="chevron-forward" size={16} color={colors.border} />}
    </TouchableOpacity>
  );
}
