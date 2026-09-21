import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
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

import OrderCard from '@/components/OrderCard';
import BackButton from '@/components/BackButton';
import { useOrders } from '@/hooks/useOrders';
import { CustomerStackScreenProps } from '@/navigation/types';
import { OrderStatus } from '@/types';
import { colors } from '@/theme/colors';

type Props = CustomerStackScreenProps<'OrderHistory'>;

type HistoryTab = 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

const TABS: HistoryTab[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

const TAB_I18N: Record<HistoryTab, string> = {
  COMPLETED: 'customer.tabCompleted',
  CANCELLED: 'customer.tabCancelled',
  EXPIRED: 'customer.tabExpired',
};

export default function OrderHistoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<HistoryTab>('COMPLETED');
  const { orders, isLoading, refresh, loadMore, hasMore, totalElements } = useOrders({
    status: activeTab as OrderStatus,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleTabChange = (tab: HistoryTab) => {
    setActiveTab(tab);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="text-lg font-bold text-primary flex-1">
          {t('customer.orderHistory')}
        </Text>
      </View>

      <View className="flex-row px-4 gap-2 mb-3">
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => handleTabChange(tab)}
              className={`rounded-full px-4 py-1.5 ${
                isActive ? 'bg-primary' : 'bg-surface border border-border'
              }`}
              activeOpacity={0.8}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? 'text-white' : 'text-text-primary'
                }`}
              >
                {t(TAB_I18N[tab])}
                {isActive && totalElements > 0 ? ` (${totalElements})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && orders.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          extraData={activeTab}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
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
            <View className="flex-1 items-center justify-center">
              <Ionicons name="receipt-outline" size={56} color={colors.primary[200]} />
              <Text className="text-base font-semibold text-text-primary text-center mt-4">
                {t('customer.noOrderHistory')}
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
