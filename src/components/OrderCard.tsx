import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import AuthImage from '@/components/AuthImage';
import { colors } from '@/theme/colors';
import { Order } from '@/types';
import { formatVendorPickupSchedule } from '@/utils/formatDate';
import { formatOrderAmount } from '@/utils/formatOrderAmount';
import { orderStatusColor, orderStatusI18nKey } from '@/utils/orderStatus';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
}

const LIST_IMAGE = 112;

export default function OrderCard({ order, onPress }: OrderCardProps) {
  const { t, i18n } = useTranslation();
  const vendorName = order.chainName ?? order.locationName ?? '';
  const currency = order.currency ?? 'RSD';
  const statusColor = orderStatusColor(order.status);
  const pickupSchedule = formatVendorPickupSchedule(order, i18n.language);
  const isInactive = order.status === 'CANCELLED' || order.status === 'EXPIRED';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-surface rounded-[14px] overflow-hidden w-full flex-row"
      style={{
        opacity: isInactive ? 0.55 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.09,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View className="bg-primary-100" style={{ width: LIST_IMAGE, height: LIST_IMAGE }}>
        <AuthImage
          uri={order.offerImageUrl ?? order.vendorImageUrl}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          fallback={
            <View className="flex-1 items-center justify-center">
              <Ionicons name="bag-handle-outline" size={28} color={colors.primary[400]} />
            </View>
          }
        />
      </View>

      <View className="flex-1 px-3 py-2.5 justify-between min-w-0">
        <View>
          <View className="flex-row items-start" style={{ gap: 8 }}>
            <View className="flex-1 min-w-0">
              {vendorName.length > 0 ? (
                <Text className="text-primary text-xs font-semibold" numberOfLines={1}>
                  {vendorName}
                </Text>
              ) : null}
              <Text className="text-text-primary text-sm font-bold mt-0.5" numberOfLines={1}>
                {order.offerName ?? t('customer.basket')}
              </Text>
            </View>
            <View className="rounded-full px-2 py-0.5 bg-primary-50" style={{ flexShrink: 0 }}>
              <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                {t(orderStatusI18nKey(order.status))}
              </Text>
            </View>
          </View>

          {pickupSchedule != null ? (
            <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
              <Ionicons name="time-outline" size={13} color={colors.text.secondary} />
              <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>
                {pickupSchedule}
              </Text>
            </View>
          ) : null}
        </View>

        <Text className="text-base font-extrabold text-primary">
          {formatOrderAmount(order.totalPrice, currency)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
