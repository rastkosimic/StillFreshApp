import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OfferCard from '@/components/OfferCard';
import { CustomerTabScreenProps } from '@/navigation/types';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useOffersRefreshStore } from '@/stores/offersRefreshStore';
import { colors } from '@/theme/colors';
import { Offer } from '@/types';

type Props = CustomerTabScreenProps<'Favorites'>;

export default function FavoritesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    favorites,
    expiredCount,
    soldOutCount,
    isLoading,
    initialized,
    loadFavorites,
    toggleFavorite,
    removeExpiredFavorites,
  } = useFavoritesStore();
  const revision = useOffersRefreshStore((state) => state.revision);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRemovingExpired, setIsRemovingExpired] = useState(false);

  useEffect(() => {
    if (revision === 0) return;
    void loadFavorites(true);
  }, [revision, loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites(true);
    }, [loadFavorites]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFavorites(true);
    setIsRefreshing(false);
  }, [loadFavorites]);

  const missedCount = expiredCount + soldOutCount;

  const onRemoveExpired = useCallback(async () => {
    if (isRemovingExpired) return;
    setIsRemovingExpired(true);
    await removeExpiredFavorites();
    setIsRemovingExpired(false);
  }, [isRemovingExpired, removeExpiredFavorites]);

  const renderItem = useCallback(
    ({ item }: { item: Offer }) => (
      <View className="px-4">
        <OfferCard
          offer={item}
          variant="list"
          greyed={item.greyedOut}
          onPress={item.greyedOut ? undefined : () => navigation.navigate('OfferDetails', { offerId: item.id })}
          onFavoriteToggle={toggleFavorite}
          isFavorite={true}
        />
      </View>
    ),
    [navigation, toggleFavorite],
  );

  if (isLoading && !initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-2 pb-3">
        <Text className="text-primary text-2xl font-bold text-center">
          {t('navigation.favorites')}
        </Text>
      </View>

      {initialized && missedCount > 0 && (
        <View
          className="mx-4 mb-3 px-4 py-3 rounded-xl flex-row items-center"
          style={{
            gap: 8,
            backgroundColor: colors.warning + '1A',
            borderWidth: 1,
            borderColor: colors.warning,
          }}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
          <Text className="text-text-primary text-sm flex-1" numberOfLines={2} style={{ minWidth: 0 }}>
            {missedCount === 1
              ? t('customer.favoritesStaleOne')
              : t('customer.favoritesStaleMany', { count: missedCount })}
          </Text>
          <TouchableOpacity
            onPress={onRemoveExpired}
            disabled={isRemovingExpired}
            className="flex-row items-center"
            style={{ gap: 2, flexShrink: 0 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            {isRemovingExpired ? (
              <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
            ) : (
              <>
                <Text className="text-primary text-sm font-semibold">
                  {t('customer.favoritesRemoveExpired')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary.DEFAULT} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={favorites}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: insets.bottom + 16,
          flexGrow: favorites.length === 0 ? 1 : undefined,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.DEFAULT]}
            tintColor={colors.primary.DEFAULT}
          />
        }
        ListEmptyComponent={
          initialized && !isLoading ? (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="heart-outline" size={56} color={colors.primary[200]} />
              <Text className="text-text-primary text-base font-semibold text-center mt-4">
                {t('customer.noFavorites')}
              </Text>
              <Text className="text-text-secondary text-sm text-center mt-2">
                {t('customer.noFavoritesDesc')}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
