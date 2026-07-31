import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OrderCard from '@/components/OrderCard';
import { ACTIVE_ORDER_STATUSES, useOrders } from '@/hooks/useOrders';
import { CustomerTabScreenProps } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = CustomerTabScreenProps<'Orders'>;

export default function OrdersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { orders, isLoading, refresh, loadMore, hasMore } = useOrders({
    status: ACTIVE_ORDER_STATUSES,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-3">
        <Text className="text-2xl font-bold text-text-primary">{t('customer.basket')}</Text>
      </View>

      {isLoading && orders.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 16,
            flexGrow: orders.length === 0 ? 1 : undefined,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.DEFAULT}
            />
          }
          onEndReached={() => {
            if (hasMore) void loadMore();
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Ionicons name="bag-outline" size={56} color={colors.primary[200]} />
              <Text className="text-base font-semibold text-text-primary text-center mt-4">
                {t('customer.noActiveOrders')}
              </Text>
              <Text className="text-sm text-text-secondary text-center mt-2 px-8">
                {t('customer.noActiveOrdersDesc')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => navigation.navigate('OrderDetail', { orderId: Number(item.id) })}
            />
          )}
        />
      )}
    </View>
  );
}
