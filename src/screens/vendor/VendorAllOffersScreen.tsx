import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { VendorTabScreenProps } from '@/navigation/types';
import { getAllOffers, invalidateOffer } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { Offer, OfferStatus } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';

type Props = VendorTabScreenProps<'VendorOffers'>;

type FilterTab = 'ALL' | 'ACTIVE' | 'EXPIRED' | 'SOLD_OUT';

const STATUS_COLOR: Record<OfferStatus, string> = {
  ACTIVE: '#34C759',
  EXPIRED: colors.error,
  SOLD_OUT: colors.error,
  INACTIVE: colors.text.secondary,
};

function resolveStatus(offer: Offer): OfferStatus {
  if (offer.soldOut) return 'SOLD_OUT';
  if (offer.expired) return 'EXPIRED';
  if (offer.active === false) return 'INACTIVE';
  return 'ACTIVE';
}

export default function VendorAllOffersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('ALL');

  const loadOffers = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const data = await getAllOffers();
        setOffers(data);
      } catch {
        Alert.alert(t('common.error'), t('errors.serverError'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      loadOffers();
    }, [loadOffers]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadOffers(true);
  };

  const onInvalidate = (offer: Offer) => {
    Alert.alert(t('vendor.invalidateConfirmTitle'), t('vendor.invalidateConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vendor.invalidateOffer'),
        style: 'destructive',
        onPress: async () => {
          try {
            await invalidateOffer(offer.id);
            loadOffers(true);
          } catch {
            Alert.alert(t('common.error'), t('errors.serverError'));
          }
        },
      },
    ]);
  };

  const onUpdate = (offer: Offer) => {
    const status = resolveStatus(offer);
    navigation.navigate('UpdateOffer', { offer, isReactivation: status !== 'ACTIVE' });
  };

  const onActionPress = (offer: Offer) => {
    const status = resolveStatus(offer);
    if (status !== 'ACTIVE') {
      onUpdate(offer);
      return;
    }
    Alert.alert(t('vendor.offerActions'), offer.name, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('vendor.updateOffer'), onPress: () => onUpdate(offer) },
      { text: t('vendor.invalidateOffer'), style: 'destructive', onPress: () => onInvalidate(offer) },
    ]);
  };

  const filtered = offers.filter((o) => {
    if (filter === 'ALL') return true;
    const s = resolveStatus(o);
    if (filter === 'ACTIVE') return s === 'ACTIVE';
    if (filter === 'EXPIRED') return s === 'EXPIRED';
    if (filter === 'SOLD_OUT') return s === 'SOLD_OUT';
    return true;
  });

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'ALL', label: t('vendor.filterAll') },
    { key: 'ACTIVE', label: t('vendor.filterActive') },
    { key: 'EXPIRED', label: t('vendor.filterExpired') },
    { key: 'SOLD_OUT', label: t('vendor.filterSoldOut') },
  ];

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: colors.surface,
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text.primary }}>
            {t('vendor.allOffers')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateOffer')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.primary.DEFAULT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {filterTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={{
                borderRadius: 20,
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: filter === tab.key ? colors.primary.DEFAULT : colors.border,
                backgroundColor: filter === tab.key ? colors.primary.DEFAULT : 'transparent',
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: filter === tab.key ? '#fff' : colors.text.primary,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        style={{ backgroundColor: colors.surface }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
        ListEmptyComponent={
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 80,
              paddingHorizontal: 24,
            }}
          >
            <Feather
              name="clipboard"
              size={56}
              color={colors.border}
              style={{ marginBottom: 16 }}
            />
            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: 8,
              }}
            >
              {t('vendor.noOffers')}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: colors.text.secondary,
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 24,
              }}
            >
              {t('vendor.noOffersDesc')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateOffer')}
              style={{
                backgroundColor: colors.primary.DEFAULT,
                borderRadius: 14,
                paddingVertical: 13,
                paddingHorizontal: 28,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                {t('vendor.dashboard.createListing')}
              </Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item, index }) => (
          <OfferRow
            offer={item}
            onPress={() => onActionPress(item)}
            isLast={index === filtered.length - 1}
          />
        )}
      />
    </View>
  );
}

function OfferRow({
  offer,
  onPress,
  isLast,
}: {
  offer: Offer;
  onPress: () => void;
  isLast?: boolean;
}) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const status = resolveStatus(offer);
  const isGreyed = status !== 'ACTIVE';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#F2F2F7',
        opacity: isGreyed ? 0.55 : 1,
      }}
    >
      {/* Thumbnail */}
      {offer.imageUrl ? (
        <Image
          source={{ uri: offer.imageUrl, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
          style={{ width: 46, height: 46, borderRadius: 10 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 10,
            backgroundColor: '#F2F2F7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="package" size={20} color={colors.text.secondary} />
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '500', color: colors.text.primary }}
          numberOfLines={1}
        >
          {offer.name}
        </Text>
        <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2 }}>
          {offer.pickupStartTime
            ? `${offer.pickupStartTime.slice(0, 5)}–${offer.pickupEndTime?.slice(0, 5) ?? ''}`
            : ''}
          {offer.quantityAvailable
            ? ` · ${offer.quantityAvailable} ${t('customer.left')}`
            : ''}
        </Text>
      </View>

      {/* Right: price + status */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary }}>
          {formatCurrency(Math.round(offer.price * 100), offer.currency)}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: STATUS_COLOR[status] }}>
          {t(`vendor.status.${status}`)}
        </Text>
      </View>

      <Feather name="chevron-right" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}
