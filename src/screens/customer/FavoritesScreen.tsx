import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
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
  const { favorites, expiredCount, soldOutCount, isLoading, initialized, loadFavorites, toggleFavorite } =
    useFavoritesStore();
  const revision = useOffersRefreshStore((state) => state.revision);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (revision === 0) return;
    void loadFavorites(true);
  }, [revision, loadFavorites]);

  // Reload on every tab focus so greyedOut state stays current
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

  // Group offers into rows of 2 for the centered layout
  const rows = useMemo(() => {
    const result: Offer[][] = [];
    for (let i = 0; i < favorites.length; i += 2) {
      result.push(favorites.slice(i, i + 2));
    }
    return result;
  }, [favorites]);

  const missedCount = expiredCount + soldOutCount;

  const renderRow = useCallback(
    ({ item: row }: { item: Offer[] }) => (
      // flexGrow: 1 + justifyContent: 'center' → equal margins when cards fit,
      // horizontal scroll kicks in automatically when they don't
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 12 }}
      >
        {row.map(offer => (
          <OfferCard
            key={offer.id}
            offer={offer}
            greyed={offer.greyedOut}
            onPress={offer.greyedOut ? undefined : () => navigation.navigate('OfferDetails', { offerId: offer.id })}
            onFavoriteToggle={toggleFavorite}
            isFavorite={true}
          />
        ))}
      </ScrollView>
    ),
    [toggleFavorite],
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
        <Text className="text-text-primary text-2xl font-bold">
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
          <Ionicons name="time-outline" size={18} color={colors.warning} />
          <Text className="text-text-primary text-sm flex-1">
            {missedCount === 1
              ? t('customer.favoritesStaleOne')
              : t('customer.favoritesStaleMany', { count: missedCount })}
          </Text>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.map(o => String(o.id)).join('-')}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 16 }}
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
            <View className="items-center justify-center px-8 py-24">
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
