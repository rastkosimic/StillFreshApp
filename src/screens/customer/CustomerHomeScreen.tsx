import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SimpleSlider from '@/components/SimpleSlider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OfferCard from '@/components/OfferCard';
import { buildCategories } from '@/config/categories';
import { CustomerTabScreenProps } from '@/navigation/types';
import { searchNearby } from '@/services/offerService';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useLocationStore } from '@/stores/locationStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useOffersRefreshStore } from '@/stores/offersRefreshStore';
import { colors } from '@/theme/colors';
import { Offer, OfferCategory } from '@/types';
import { applyOfferReservations } from '@/utils/applyOfferReservations';

// Belgrade fallback — used when location permission is denied or unavailable
const BELGRADE = { latitude: 44.7866, longitude: 20.4489 };

// ── CustomerHomeScreen ─────────────────────────────────────────────────────────

type Props = CustomerTabScreenProps<'CustomerHome'>;

export default function CustomerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { coordinates, getLocation, permissionStatus, requestPermission } = useLocationStore();

  const [offers, setOffers] = useState<Offer[]>([]);
  const categories = useMemo(() => buildCategories(t), [t]);
  const [selectedCategory, setSelectedCategory] = useState<OfferCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [range, setRange] = useState(20);
  const { favoriteIds, toggleFavorite, loadFavorites } = useFavoritesStore();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const revision = useOffersRefreshStore((state) => state.revision);
  const reservations = useOffersRefreshStore((state) => state.reservations);
  const clearReservations = useOffersRefreshStore((state) => state.clearReservations);
  const [sliderValue, setSliderValue] = useState(20);
  const [rangeOpen, setRangeOpen] = useState(false);

  // Refresh unread badge each time this screen comes into view
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount]),
  );

  // Request location on mount, then trigger initial offer load
  useEffect(() => {
    (async () => {
      if (permissionStatus === 'undetermined') {
        await requestPermission();
      }
      await getLocation();
      // Load offers once location is resolved (or fell back to Belgrade)
      loadOffers();
      loadFavorites();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when category or range changes after initial mount
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadOffers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, range]);

  // Fetch nearby offers — reads coordinates from store directly to avoid
  // being recreated every time coordinates update (which would re-trigger effects)
  const loadOffers = useCallback(
    async (refreshing = false, silent = false) => {
      if (silent) {
        // Background refresh after reservation — keep current list visible.
      } else if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const coords = useLocationStore.getState().coordinates ?? BELGRADE;
      try {
        const { offers: fetched } = await searchNearby({
          latitude: coords.latitude,
          longitude: coords.longitude,
          range,
          sort: 'distance',
          ...(selectedCategory ? { category: selectedCategory } : {}),
        });
        setOffers(fetched);
        clearReservations();
      } catch {
        // Show empty state on error — don't leave spinner up forever
      } finally {
        if (!silent) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [selectedCategory, range, clearReservations],
  );

  useEffect(() => {
    if (revision === 0) return;
    void loadOffers(false, true);
  }, [revision, loadOffers]);

  useFocusEffect(
    useCallback(() => {
      if (revision > 0) {
        void loadOffers(false, true);
      }
    }, [revision, loadOffers]),
  );

  const displayOffers = useMemo(
    () => applyOfferReservations(offers, reservations),
    [offers, reservations],
  );

  // Section grouping — uses backend-provided fields only, never computed client-side
  const sections = useMemo(() => {
    const active = displayOffers.filter(o => !o.greyedOut && !o.expired && !o.soldOut);
    const missed = displayOffers.filter(o => o.greyedOut || o.expired || o.soldOut);
    return {
      collectNow: active.filter(o => o.collectNow),
      collectForLunch: active.filter(
        o =>
          !o.collectNow &&
          o.pickupMealSlot === 'LUNCH' &&
          (o.pickupDaySlot === 'TODAY' || o.pickupDaySlot === 'TOMORROW'),
      ),
      collectToday: active.filter(o => !o.collectNow && o.pickupDaySlot === 'TODAY'),
      collectForDinner: active.filter(
        o =>
          !o.collectNow &&
          o.pickupMealSlot === 'DINNER' &&
          (o.pickupDaySlot === 'TODAY' || o.pickupDaySlot === 'TOMORROW'),
      ),
      collectTomorrow: active.filter(o => !o.collectNow && o.pickupDaySlot === 'TOMORROW'),
      missed,
    };
  }, [displayOffers]);

  // ── Section renderer ────────────────────────────────────────────────────────

  const renderSection = (
    titleKey: string,
    icon: string,
    data: Offer[],
    opts?: { showLive?: boolean; greyed?: boolean },
  ) => {
    if (data.length === 0) return null;

    return (
      <View className="mb-0.5">
        {/* Section header */}
        <View className="flex-row justify-between items-center px-4 pt-3.5 pb-2.5">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text style={{ fontSize: 15 }}>{icon}</Text>
            <Text
              className={`text-base font-bold ${
                opts?.greyed ? 'text-text-secondary' : 'text-text-primary'
              }`}
            >
              {t(titleKey)}
            </Text>
            {opts?.showLive && (
              <View className="bg-accent rounded-full px-2 py-0.5">
                <Text className="text-xs font-extrabold text-text-primary">
                  {t('customer.live')}
                </Text>
              </View>
            )}
            {!opts?.greyed && (
              <View className="bg-border rounded-full px-2 py-0.5">
                <Text className="text-text-secondary text-xs font-semibold">
                  {data.length}
                </Text>
              </View>
            )}
          </View>
          {!opts?.greyed && (
            <TouchableOpacity>
              <Text className="text-primary text-sm font-semibold">
                {t('customer.seeAll')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal card scroll — ScrollView avoids VirtualizedList nesting warnings */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14, gap: 12 }}
        >
          {data.map(offer => (
            <OfferCard
              key={offer.id}
              offer={offer}
              greyed={opts?.greyed}
              onPress={() => navigation.navigate('OfferDetails', { offerId: offer.id })}
              onFavoriteToggle={opts?.greyed ? undefined : toggleFavorite}
              isFavorite={favoriteIds.has(offer.id)}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>

      {/* Location header */}
      <View className="px-4 pt-1.5 pb-2">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="w-7 h-7 rounded-full bg-primary-50 items-center justify-center">
            <Ionicons name="location-sharp" size={14} color={colors.primary.DEFAULT} />
          </View>
          <View className="flex-1">
            <Text className="text-text-secondary text-xs">{t('customer.chosenLocation')}</Text>
            <View className="flex-row items-center" style={{ gap: 3 }}>
              <Text className="text-text-primary text-sm font-bold">Belgrade</Text>
              <Ionicons name="chevron-down" size={12} color={colors.text.secondary} />
            </View>
          </View>

          {/* Range chip */}
          <TouchableOpacity
            onPress={() => setRangeOpen((v) => !v)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
              backgroundColor: rangeOpen ? colors.primary.DEFAULT : colors.surface,
              borderWidth: 1,
              borderColor: rangeOpen ? colors.primary.DEFAULT : colors.border,
            }}
          >
            <Ionicons
              name="navigate-outline"
              size={12}
              color={rangeOpen ? '#fff' : colors.primary.DEFAULT}
            />
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: rangeOpen ? '#fff' : colors.text.primary,
            }}>
              {range} km
            </Text>
            <Ionicons
              name={rangeOpen ? 'chevron-up' : 'chevron-down'}
              size={10}
              color={rangeOpen ? '#fff' : colors.text.secondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center"
            onPress={() => navigation.navigate('VendorMap')}
          >
            <Ionicons name="map-outline" size={18} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center"
            onPress={() => navigation.navigate('CustomerNotifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={18} color={colors.text.primary} />
            {unreadCount > 0 && (
              <View
                className="absolute top-0 right-0 rounded-full items-center justify-center"
                style={{
                  minWidth: 16,
                  height: 16,
                  backgroundColor: colors.error,
                  paddingHorizontal: unreadCount > 9 ? 3 : 0,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 16 }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Range slider panel — expands below the header when chip is tapped */}
      {rangeOpen && (
        <View style={{
          marginHorizontal: 16, marginBottom: 8, padding: 14,
          backgroundColor: colors.surface, borderRadius: 14,
          borderWidth: 1, borderColor: colors.border,
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.secondary }}>
              {t('customer.searchRadius')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary.DEFAULT }}>
              {Math.round(sliderValue)} km
            </Text>
          </View>

          <SimpleSlider
            value={sliderValue}
            min={1}
            max={50}
            step={1}
            onValueChange={(v) => setSliderValue(v)}
            onSlidingComplete={(v) => {
              setSliderValue(v);
              setRange(v);
              setRangeOpen(false);
            }}
            thumbColor={colors.primary.DEFAULT}
            minimumTrackColor={colors.primary.DEFAULT}
            maximumTrackColor={colors.border}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            {[1, 10, 20, 30, 50].map((mark) => (
              <Text key={mark} style={{ fontSize: 10, color: colors.text.secondary }}>
                {mark} km
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Category filter pills — fixed-height wrapper prevents vertical stretch */}
      <View style={{ height: 50 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', gap: 8, paddingBottom: 6 }}
      >
        <TouchableOpacity
          onPress={() => setSelectedCategory(null)}
          className={`rounded-full px-4 py-1.5 ${
            selectedCategory === null ? 'bg-primary' : 'bg-surface border border-border'
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              selectedCategory === null ? 'text-white' : 'text-text-primary'
            }`}
          >
            {t('customer.allCategories')}
          </Text>
        </TouchableOpacity>

        {categories.map(cat => (
          <TouchableOpacity
            key={cat.value}
            onPress={() => setSelectedCategory(cat.value)}
            className={`rounded-full px-4 py-1.5 ${
              selectedCategory === cat.value
                ? 'bg-primary'
                : 'bg-surface border border-border'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                selectedCategory === cat.value ? 'text-white' : 'text-text-primary'
              }`}
            >
              {cat.displayName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      </View>

      <View className="h-px bg-border" />

      {/* Full-screen loader on first load */}
      {isLoading && displayOffers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadOffers(true)}
              colors={[colors.primary.DEFAULT]}
              tintColor={colors.primary.DEFAULT}
            />
          }
        >
          {renderSection('customer.collectNow', '⚡', sections.collectNow, { showLive: true })}
          {renderSection('customer.collectForLunch', '🌤️', sections.collectForLunch)}
          {renderSection('customer.collectToday', '📦', sections.collectToday)}
          {renderSection('customer.collectForDinner', '🌙', sections.collectForDinner)}
          {renderSection('customer.collectTomorrow', '📅', sections.collectTomorrow)}
          {renderSection('customer.youMissedThis', '😔', sections.missed, { greyed: true })}

          {/* Empty state */}
          {!isLoading && displayOffers.length === 0 && (
            <View className="items-center justify-center px-8 py-16">
              <Ionicons name="leaf-outline" size={56} color={colors.primary[200]} />
              <Text className="text-text-primary text-base font-semibold text-center mt-4">
                {t('customer.noOffersNearby')}
              </Text>
              <Text className="text-text-secondary text-sm text-center mt-2">
                {t('customer.noOffersNearbyDesc')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

