import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthImage from '@/components/AuthImage';
import BackButton from '@/components/BackButton';
import RejectOrderModal from '@/components/RejectOrderModal';
import { VendorStackScreenProps } from '@/navigation/types';
import { getOrderById, rejectOrder } from '@/services/orderService';
import { colors } from '@/theme/colors';
import { ApiError, Order } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatVendorPickupSchedule } from '@/utils/formatDate';
import { formatOrderAmount } from '@/utils/formatOrderAmount';
import { canRejectOrder, orderStatusColor, orderStatusI18nKey } from '@/utils/orderStatus';

type Props = VendorStackScreenProps<'VendorOrderDetail'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sm text-text-secondary">{label}</Text>
      <Text className="text-sm font-semibold text-text-primary flex-shrink ml-3 text-right">
        {value}
      </Text>
    </View>
  );
}

export default function VendorOrderDetailScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getOrderById(orderId);
      setOrder(data);
    } catch {
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void loadOrder();
    }, [loadOrder]),
  );

  const currency = order?.currency ?? 'RSD';
  const isCompleted = order?.status === 'COMPLETED';
  const isCancelled = order?.status === 'CANCELLED';
  const canCancel = order != null && canRejectOrder(order.status);
  const pickupSchedule = order
    ? formatVendorPickupSchedule(order, i18n.language)
    : null;

  const handleReject = async (reason: string) => {
    if (!order) return;
    setIsRejecting(true);
    try {
      await rejectOrder(order.id, { reason });
      setRejectVisible(false);
      setOrder({ ...order, status: 'CANCELLED', cancellationReason: reason });
      Alert.alert(t('common.success'), t('vendor.orderDetail.cancelSuccess'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const apiErr = err as ApiError;
      Alert.alert(
        t('common.error'),
        apiErr.message?.trim() ? apiErr.message : t('errors.orderCancelFailed'),
      );
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center bg-background px-4 py-3 gap-3 border-b border-border">
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="text-[17px] font-semibold text-primary flex-1">
          {t('vendor.orderDetail.title')}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : !order ? (
        <View className="flex-1 items-center justify-center px-6">
          <Feather name="inbox" size={48} color={colors.primary[200]} />
          <Text className="text-base font-semibold text-text-primary text-center mt-4 mb-1">
            {t('vendor.orderDetail.notFoundTitle')}
          </Text>
          <Text className="text-sm text-text-secondary text-center mb-4">
            {t('vendor.orderDetail.notFoundDesc')}
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text className="text-primary font-semibold">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: canCancel ? 24 : insets.bottom + 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Order summary card */}
            <View
              className="bg-surface rounded-[14px] p-4 mb-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View className="flex-row gap-3 mb-4">
                <View className="w-20 h-20 rounded-xl overflow-hidden bg-primary-100">
                  <AuthImage
                    uri={order.offerImageUrl ?? order.vendorImageUrl}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    fallback={
                      <View className="flex-1 items-center justify-center">
                        <Feather name="shopping-bag" size={26} color={colors.primary[400]} />
                      </View>
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-text-primary" numberOfLines={2}>
                    {order.offerName ?? `#${order.orderId}`}
                  </Text>
                  <Text
                    className="text-xs font-semibold mt-2"
                    style={{ color: orderStatusColor(order.status) }}
                  >
                    {t(orderStatusI18nKey(order.status))}
                  </Text>
                </View>
              </View>

              <View className="border-t border-border pt-3">
                <DetailRow label={t('vendor.orderDetail.orderId')} value={`#${order.orderId}`} />
                <DetailRow label={t('vendor.orderDetail.quantity')} value={String(order.quantity)} />
                {pickupSchedule != null && (
                  <DetailRow
                    label={t('vendor.orderDetail.pickupBy')}
                    value={pickupSchedule}
                  />
                )}
                {isCancelled && order.cancellationReason != null && order.cancellationReason.length > 0 && (
                  <DetailRow
                    label={t('vendor.orderDetail.cancelReasonLabel')}
                    value={order.cancellationReason}
                  />
                )}
              </View>
            </View>

            {/* Earnings card */}
            <View className="bg-surface rounded-[14px] p-4 mb-4 border border-border">
              <Text className="text-sm font-bold text-text-primary mb-2">
                {t('vendor.orderDetail.earnings')}
              </Text>

              {isCompleted && order.netAmountCents != null ? (
                <>
                  {order.grossAmountCents != null && (
                    <DetailRow
                      label={t('vendor.orderDetail.customerPays')}
                      value={formatCurrency(order.grossAmountCents, currency)}
                    />
                  )}
                  {order.platformFeeCents != null && (
                    <DetailRow
                      label={
                        order.feePercentApplied != null
                          ? t('vendor.orderDetail.platformFeePct', {
                              pct: order.feePercentApplied,
                            })
                          : t('vendor.orderDetail.platformFee')
                      }
                      value={`- ${formatCurrency(order.platformFeeCents, currency)}`}
                    />
                  )}
                  <View className="flex-row justify-between border-t border-border pt-2 mt-1">
                    <Text className="text-base font-bold text-text-primary">
                      {t('vendor.orderDetail.netEarnings')}
                    </Text>
                    <Text className="text-base font-extrabold text-primary">
                      {formatCurrency(order.netAmountCents, currency)}
                    </Text>
                  </View>
                  {order.settledAt != null && (
                    <Text className="text-xs text-text-secondary mt-2">
                      {t('vendor.orderDetail.settled')}
                    </Text>
                  )}
                </>
              ) : isCancelled ? (
                <>
                  <DetailRow
                    label={t('vendor.orderDetail.customerPays')}
                    value={formatOrderAmount(order.totalPrice, currency)}
                  />
                  <Text className="text-xs text-text-secondary mt-2">
                    {t('vendor.orderDetail.cancelledNote')}
                  </Text>
                </>
              ) : (
                <>
                  <DetailRow
                    label={t('vendor.orderDetail.customerPays')}
                    value={formatOrderAmount(order.totalPrice, currency)}
                  />
                  <Text className="text-xs text-text-secondary mt-2">
                    {t('vendor.orderDetail.earningsPending')}
                  </Text>
                </>
              )}
            </View>
          </ScrollView>

          {canCancel && (
            <View
              className="bg-surface px-4 pt-3 border-t border-border"
              style={{ paddingBottom: insets.bottom + 12 }}
            >
              <TouchableOpacity
                onPress={() => setRejectVisible(true)}
                disabled={isRejecting}
                className="bg-error rounded-xl py-4 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-base">
                  {t('vendor.orderDetail.cancelOrder')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <RejectOrderModal
        visible={rejectVisible}
        isSubmitting={isRejecting}
        onClose={() => setRejectVisible(false)}
        onConfirm={handleReject}
      />
    </View>
  );
}
