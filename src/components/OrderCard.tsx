import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import AuthImage from '@/components/AuthImage';
import { colors } from '@/theme/colors';
import { Order } from '@/types';
import { formatPickupDeadline } from '@/utils/formatDate';
import { formatOrderAmount } from '@/utils/formatOrderAmount';
import { orderStatusColor, orderStatusI18nKey } from '@/utils/orderStatus';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
}

export default function OrderCard({ order, onPress }: OrderCardProps) {
  const { t, i18n } = useTranslation();
  const vendorName = order.chainName ?? order.locationName ?? '';
  const currency = order.currency ?? 'RSD';
  const statusColor = orderStatusColor(order.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-surface rounded-[14px] p-4 mb-3"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View className="flex-row gap-3">
        <View className="w-16 h-16 rounded-xl overflow-hidden bg-primary-100">
          <AuthImage
            uri={order.offerImageUrl ?? order.vendorImageUrl}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            fallback={
              <View className="flex-1 items-center justify-center">
                <Ionicons name="bag-handle-outline" size={24} color={colors.primary[400]} />
              </View>
            }
          />
        </View>

        <View className="flex-1">
          <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
            {order.offerName ?? t('customer.basket')}
          </Text>
          {vendorName.length > 0 && (
            <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
              {vendorName}
            </Text>
          )}
          {order.pickupBy != null && (
            <Text className="text-xs text-text-secondary mt-1">
              {t('customer.pickupBy')}: {formatPickupDeadline(order.pickupBy, i18n.language)}
            </Text>
          )}
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-sm font-extrabold text-primary">
              {formatOrderAmount(order.totalPrice, currency)}
            </Text>
            <Text className="text-xs font-semibold" style={{ color: statusColor }}>
              {t(orderStatusI18nKey(order.status))}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
