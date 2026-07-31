import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVendorIdentity } from '@/hooks/useVendorIdentity';
import { VendorTabScreenProps } from '@/navigation/types';
import { getDashboard, getVendorProfile } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { colors } from '@/theme/colors';
import { VendorDashboardResponse } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';

type Props = VendorTabScreenProps<'VendorDashboard'>;

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export default function VendorDashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const { identity, refresh: refreshIdentity } = useVendorIdentity();

  const [dashboard, setDashboard] = useState<VendorDashboardResponse | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = identity.isAdmin || user?.role === 'VENDOR_ADMIN';
  const isChain = identity.isChainLocation || user?.vendor?.isChainLocation === true;
  const isHeadquarters = identity.isHeadquarters || user?.vendor?.isHeadquarters === true;
  const usesSharedPaymentAccount = identity.usesSharedPaymentAccount;
  const vendorId = identity.vendorId ?? user?.vendor?.id ?? null;
  const currency = dashboard?.payoutBalance?.currency ?? 'RSD';

  // HQ-only. Branch admins never manage the chain banking model.
  const showBankingModel = isAdmin && isChain && isHeadquarters;
  // UNIQUE always; chain HQ always; branch only when INDIVIDUAL (own payout account).
  const showPaymentSettings =
    isAdmin && (!isChain || isHeadquarters || !usesSharedPaymentAccount);
  const showLocations = isAdmin && isChain && isHeadquarters;
  const showWorkers = isAdmin && isChain;
  const showUpgrade = isAdmin && !isChain;

  const loadData = useCallback(async () => {
    if (!user || !vendorId) return;
    await Promise.all([
      getVendorProfile(vendorId)
        .then((p) => {
          setLocationName(p.locationName ?? null);
          setProfileImageUrl(p.imageUrl ?? null);
        })
        .catch(() => null),
      getDashboard(vendorId, 'week')
        .then(setDashboard)
        .catch(() => null),
    ]);
  }, [user, vendorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh unread badge + identity (banking model may change mid-session) each focus
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
      void refreshIdentity();
    }, [fetchUnreadCount, refreshIdentity]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadData(), refreshIdentity()]);
    setIsRefreshing(false);
  }, [loadData, refreshIdentity]);

  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const summary = dashboard?.summary;
  const ratingsData = dashboard?.ratings;

  const earnings =
    summary != null
      ? formatCurrency(summary.totalVendorEarningsCents, currency)
      : '—';
  const activeOrders =
    summary != null ? String(summary.activeOrderCount) : '—';
  const soldUnits =
    summary != null ? String(summary.totalUnitsSold) : '—';
  const rating =
    ratingsData != null ? `${ratingsData.averageRating.toFixed(1)} ★` : '—';

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary.DEFAULT}
        />
      }
    >
      <View
        className="bg-surface border-b border-border px-5 pb-3.5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="text-[11px] text-text-secondary font-medium mb-1">
          {todayStr}
        </Text>
        <View className="flex-row items-end justify-between">
          <Text className="text-[28px] font-bold text-text-primary leading-8">
            {t('vendor.dashboard.title')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('VendorProfile')}
            activeOpacity={0.8}
            hitSlop={8}
          >
            <View className="w-14 h-14 rounded-full overflow-hidden bg-primary items-center justify-center">
              {profileImageUrl ? (
                <Image
                  source={{
                    uri: profileImageUrl,
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  }}
                  className="w-14 h-14"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-xl font-bold text-text-inverse">
                  {(user?.email ?? '').slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
        {locationName ? (
          <Text className="text-xs text-text-secondary mt-0.5">
            {locationName}
            {user?.vendor?.chainName ? ` · ${user.vendor.chainName}` : ''}
            {user?.vendor?.isHeadquarters ? ` · ${t('vendor.headquarters')}` : ''}
          </Text>
        ) : user?.vendor?.chainName ? (
          <Text className="text-xs text-text-secondary mt-0.5">
            {user.vendor.chainName}
            {user.vendor.isHeadquarters ? ` · ${t('vendor.headquarters')}` : ''}
          </Text>
        ) : null}
      </View>

      <View className="p-3">
        <View className="flex-row gap-2.5 mb-2.5">
          <MetricCard label={t('vendor.dashboard.yourEarnings')} value={earnings} highlight />
          <MetricCard label={t('vendor.dashboard.activeOrders')} value={activeOrders} />
        </View>
        <View className="flex-row gap-2.5">
          <MetricCard label={t('vendor.dashboard.unitsSold')} value={soldUnits} />
          <MetricCard label={t('vendor.dashboard.rating')} value={rating} />
        </View>
      </View>

      <SectionLabel title={t('vendor.dashboard.quickActions')} />
      <View className="bg-surface">
        <ListRow
          icon="plus-circle"
          label={t('vendor.dashboard.createListing')}
          onPress={() => navigation.navigate('CreateOffer')}
        />
        <ListRow
          icon="clipboard"
          label={t('vendor.dashboard.viewAllOffers')}
          onPress={() => navigation.navigate('VendorOffers')}
        />
        <ListRow
          icon="activity"
          label={t('vendor.dashboard.viewAnalytics')}
          onPress={() => navigation.navigate('Analytics')}
        />
        <ListRow
          icon="bell"
          label={t('vendor.dashboard.notifications')}
          onPress={() => navigation.navigate('VendorNotifications')}
          badge={unreadCount > 0 ? unreadCount : undefined}
          isLast
        />
      </View>

      {isAdmin && (
        <>
          <SectionLabel title={t('vendor.dashboard.account')} />
          <View className="bg-surface">
            {showPaymentSettings && (
              <ListRow
                icon="credit-card"
                label={t('vendor.dashboard.paymentSettings')}
                onPress={() => navigation.navigate('VendorPaymentSettings')}
                isLast={
                  !showLocations && !showWorkers && !showBankingModel && !showUpgrade
                }
              />
            )}
            {showLocations && (
              <ListRow
                icon="map-pin"
                label={t('vendor.dashboard.manageLocations')}
                onPress={() => navigation.navigate('VendorChainLocationManagement')}
                isLast={!showWorkers && !showBankingModel && !showUpgrade}
              />
            )}
            {showWorkers && (
              <ListRow
                icon="users"
                label={t('vendor.dashboard.manageWorkers')}
                onPress={() => navigation.navigate('VendorWorkerManagement', {})}
                isLast={!showBankingModel && !showUpgrade}
              />
            )}
            {showBankingModel && (
              <ListRow
                icon="repeat"
                label={t('vendor.dashboard.bankingModelManagement')}
                onPress={() => navigation.navigate('VendorBankingModelManagement')}
                isLast={!showUpgrade}
              />
            )}
            {showUpgrade && (
              <ListRow
                icon="link"
                label={t('vendor.dashboard.upgradeToChain')}
                onPress={() => navigation.navigate('VendorUpgradeToChain')}
                isLast
              />
            )}
          </View>
        </>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="text-xs text-text-secondary font-semibold uppercase tracking-wide mt-5 mb-1.5 mx-4">
      {title}
    </Text>
  );
}

function ListRow({
  icon,
  label,
  onPress,
  badge,
  isLast,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  badge?: number;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center py-3 px-4 gap-3.5 bg-surface"
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#F2F2F7',
      }}
    >
      <Feather name={icon} size={20} color={colors.text.secondary} />
      <Text className="flex-1 text-[15px] text-text-primary">{label}</Text>
      {badge !== undefined && (
        <View className="bg-error rounded-[10px] min-w-5 h-5 items-center justify-center px-1">
          <Text className="text-text-inverse text-[11px] font-bold">
            {badge > 9 ? '9+' : String(badge)}
          </Text>
        </View>
      )}
      <Feather name="chevron-right" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View
      className="flex-1 bg-surface rounded-[14px] p-3.5"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text className="text-xs text-text-secondary font-medium mb-1.5">{label}</Text>
      <Text
        className="text-[22px] font-bold"
        style={{ color: highlight ? colors.primary.DEFAULT : colors.text.primary }}
      >
        {value}
      </Text>
    </View>
  );
}
