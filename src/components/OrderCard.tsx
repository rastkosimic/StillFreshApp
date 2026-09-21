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

function VendorAvatar({ uri, size }: { uri?: string; size: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: -(size / 2),
        left: 10,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: colors.surface,
        backgroundColor: colors.primary[100],
        overflow: 'hidden',
      }}
    >
      <AuthImage
        uri={uri}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="storefront-outline" size={size * 0.5} color={colors.primary[400]} />
          </View>
        }
      />
    </View>
  );
}

export default function OrderCard({ order, onPress }: OrderCardProps) {
  const { t, i18n } = useTranslation();
  const vendorName = order.chainName ?? order.locationName ?? '';
  const location =
    order.chainName && order.locationName ? order.locationName : (order.address ?? '');
  const currency = order.currency ?? 'RSD';
  const statusColor = orderStatusColor(order.status);
  const pickupSchedule = formatVendorPickupSchedule(order, i18n.language);
  const isInactive = order.status === 'CANCELLED' || order.status === 'EXPIRED';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-surface rounded-[14px] overflow-hidden w-full"
      style={{
        opacity: isInactive ? 0.55 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.09,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View className="w-full h-40 bg-primary-100">
        <AuthImage
          uri={order.offerImageUrl ?? order.vendorImageUrl}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          fallback={
            <View className="flex-1 items-center justify-center">
              <Ionicons name="bag-handle-outline" size={36} color={colors.primary[400]} />
            </View>
          }
        />
        <View className="absolute top-2 right-2 rounded-full px-2 py-0.5 bg-surface">
          <Text className="text-xs font-semibold" style={{ color: statusColor }}>
            {t(orderStatusI18nKey(order.status))}
          </Text>
        </View>
        <VendorAvatar uri={order.vendorImageUrl} size={64} />
      </View>

      <View className="px-3.5 pt-10 pb-3">
        {vendorName.length > 0 ? (
          <Text className="text-primary text-xs font-semibold" numberOfLines={1}>
            {vendorName}
          </Text>
        ) : null}
        <Text className="text-text-primary text-base font-bold mt-0.5" numberOfLines={1}>
          {order.offerName ?? t('customer.basket')}
        </Text>

        {pickupSchedule != null ? (
          <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
            <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
            <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>
              {pickupSchedule}
            </Text>
          </View>
        ) : null}

        {location.length > 0 ? (
          <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
            <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
            <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        <View className="h-px bg-border mt-2.5 mb-2" />
        <Text className="text-base font-extrabold text-primary">
          {formatOrderAmount(order.totalPrice, currency)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
