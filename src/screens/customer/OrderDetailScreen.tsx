import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import CancelOrderModal from '@/components/CancelOrderModal';
import RatingSubmissionModal from '@/components/RatingSubmissionModal';
import { CustomerStackScreenProps } from '@/navigation/types';
import {
  cancelOrder,
  confirmPickup,
  getOrderById,
  getOrderVendorId,
  getOrderVendorName,
} from '@/services/orderService';
import {
  getMyRatingForOrder,
  hasOrderBeenRated,
} from '@/services/ratingService';
import { colors } from '@/theme/colors';
import { Order, RatingResponse } from '@/types';
import { ApiError } from '@/types';
import { formatVendorPickupSchedule } from '@/utils/formatDate';
import { formatOrderAmount } from '@/utils/formatOrderAmount';
import { isActiveOrderStatus, orderStatusColor, orderStatusI18nKey } from '@/utils/orderStatus';
import { PickupCaptureTimeoutError, pollOrderStatus } from '@/utils/orderPolling';
import { useLocationStore } from '@/stores/locationStore';
import { useBasketStore } from '@/stores/basketStore';

type Props = CustomerStackScreenProps<'OrderDetail'>;

export default function OrderDetailScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingVendorId, setRatingVendorId] = useState<number | null>(null);
  const [ratingOrderId, setRatingOrderId] = useState<number | string | null>(null);
  const [ratingVendorName, setRatingVendorName] = useState('');
  const [isRatingUpdate, setIsRatingUpdate] = useState(false);
  const [existingRating, setExistingRating] = useState<RatingResponse | null>(null);
  const [orderHasRating, setOrderHasRating] = useState<boolean | null>(null);
  const [isLoadingRatingStatus, setIsLoadingRatingStatus] = useState(false);
  const shouldNavigateHomeAfterRatingRef = useRef(false);

  const navigateHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerTabs', params: { screen: 'CustomerHome' } }],
    });
  }, [navigation]);

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

  const loadRatingStatus = useCallback(async (completedOrder: Order) => {
    setIsLoadingRatingStatus(true);
    try {
      const hasRated = await hasOrderBeenRated(completedOrder.id);
      setOrderHasRating(hasRated);
      if (hasRated) {
        const rating = await getMyRatingForOrder(Number(completedOrder.id));
        setExistingRating(rating);
      } else {
        setExistingRating(null);
      }
    } catch {
      setOrderHasRating(null);
      setExistingRating(null);
    } finally {
      setIsLoadingRatingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (order?.status === 'COMPLETED') {
      void loadRatingStatus(order);
    } else {
      setOrderHasRating(null);
      setExistingRating(null);
    }
  }, [order?.status, order?.id, loadRatingStatus]);

  const openRatingModal = useCallback(
    async (
      targetOrder: Order,
      options?: { isUpdate?: boolean; navigateHomeAfter?: boolean },
    ) => {
      const vendorId = getOrderVendorId(targetOrder);
      if (vendorId == null) return;

      let rating = existingRating;
      const isUpdate = options?.isUpdate ?? orderHasRating === true;

      if (isUpdate && rating == null) {
        try {
          rating = await getMyRatingForOrder(Number(targetOrder.id));
          setExistingRating(rating);
        } catch {
          rating = null;
        }
      }

      shouldNavigateHomeAfterRatingRef.current = options?.navigateHomeAfter ?? false;
      setRatingVendorId(vendorId);
      setRatingOrderId(targetOrder.id);
      setRatingVendorName(getOrderVendorName(targetOrder));
      setIsRatingUpdate(isUpdate);
      setShowRatingModal(true);
    },
    [existingRating, orderHasRating],
  );

  const handleConfirmPickup = async () => {
    if (!order) return;
    setIsConfirming(true);
    try {
      await confirmPickup(order.id);
      const updated = await pollOrderStatus(order.id, 'COMPLETED');
      setOrder(updated);
      void useBasketStore.getState().fetchActiveCount();
      Alert.alert(t('common.success'), t('customer.pickupConfirmed'), [
        {
          text: t('common.ok'),
          onPress: async () => {
            try {
              const alreadyRated = await hasOrderBeenRated(updated.id);
              if (!alreadyRated) {
                await openRatingModal(updated, { isUpdate: false, navigateHomeAfter: true });
              }
            } catch {
              await openRatingModal(updated, { isUpdate: false, navigateHomeAfter: true });
            }
          },
        },
      ]);
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = apiErr.message ?? '';
      if (msg.includes('INVALID_STATUS')) {
        Alert.alert(t('common.error'), t('errors.invalidOrderStatus'));
        await loadOrder();
      } else if (msg.includes('NO_PAYMENT_REFERENCE')) {
        Alert.alert(t('common.error'), t('errors.noPaymentReference'));
      } else if (err instanceof PickupCaptureTimeoutError) {
        Alert.alert(t('common.error'), t('customer.pickupTimeout'));
        await loadOrder();
      } else {
        Alert.alert(t('common.error'), t('errors.serverError'));
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async (reason?: string) => {
    if (!order) return;
    setIsCancelling(true);
    try {
      const { coordinates, getLocation } = useLocationStore.getState();
      let userLat = coordinates?.latitude;
      let userLon = coordinates?.longitude;
      if (userLat == null || userLon == null) {
        await getLocation();
        const updated = useLocationStore.getState().coordinates;
        userLat = updated?.latitude;
        userLon = updated?.longitude;
      }

      await cancelOrder(order.id, {
        reason,
        ...(userLat != null && userLon != null ? { userLat, userLon } : {}),
      });
      void useBasketStore.getState().fetchActiveCount();
      setCancelVisible(false);
      Alert.alert(t('common.success'), t('customer.orderCancelled'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('errors.orderCancelFailed'));
    } finally {
      setIsCancelling(false);
    }
  };

  const closeRatingModal = () => {
    setShowRatingModal(false);
    setRatingVendorId(null);
    setRatingOrderId(null);
    setRatingVendorName('');
    setIsRatingUpdate(false);
    shouldNavigateHomeAfterRatingRef.current = false;
  };

  const handleRatingSubmitted = () => {
    const shouldNavigateHome = shouldNavigateHomeAfterRatingRef.current;
    shouldNavigateHomeAfterRatingRef.current = false;

    void loadOrder();
    if (order?.status === 'COMPLETED') {
      void loadRatingStatus(order);
    }

    if (shouldNavigateHome) {
      navigateHome();
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-text-secondary mb-4">{t('errors.notFound')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary font-semibold">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currency = order.currency ?? 'RSD';
  const vendorName = order.chainName ?? order.locationName ?? '';
  const isActive = isActiveOrderStatus(order.status);
  const isCompleted = order.status === 'COMPLETED';
  const statusColor = orderStatusColor(order.status);
  const pickupSchedule = formatVendorPickupSchedule(order, i18n.language);
  const canRateOrder = isCompleted && getOrderVendorId(order) != null;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="text-lg font-bold text-primary flex-1">
          {t('customer.orderDetail')}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="bg-surface rounded-2xl overflow-hidden mb-4"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <View style={{ height: 140 }}>
            <View className="absolute inset-0 bg-primary-100">
              <AuthImage
                uri={order.offerImageUrl ?? order.vendorImageUrl}
                style={{ width: '100%', height: 140 }}
                contentFit="cover"
                fallback={
                  <View className="flex-1 items-center justify-center bg-primary-100">
                    <Ionicons name="bag-handle-outline" size={36} color={colors.primary[400]} />
                  </View>
                }
              />
              <View className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
            </View>

            <View className="flex-1 justify-end px-4 py-3">
              <Text className="text-white font-bold text-base" numberOfLines={2}>
                {order.offerName}
              </Text>
              {vendorName.length > 0 && (
                <Text className="text-white text-xs mt-0.5" numberOfLines={1}>
                  {vendorName}
                </Text>
              )}
              <View className="flex-row items-center mt-2">
                <View className="rounded-full px-2 py-0.5 bg-surface">
                  <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                    {t(orderStatusI18nKey(order.status))}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="px-4 pt-4 pb-4">
            {pickupSchedule != null && (
              <View className="mb-3">
                <Text className="text-xs text-text-secondary">{t('customer.pickupBy')}</Text>
                <Text className="text-sm font-semibold text-text-primary mt-0.5">
                  {pickupSchedule}
                </Text>
              </View>
            )}

            {order.address != null && (
              <View className="mb-3">
                <Text className="text-xs text-text-secondary">{t('customer.directions')}</Text>
                <Text className="text-sm text-text-primary mt-0.5">{order.address}</Text>
              </View>
            )}

            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-text-secondary">{t('customer.quantity')}</Text>
              <Text className="text-sm font-semibold text-text-primary">{order.quantity}</Text>
            </View>

            <View className="flex-row justify-between border-t border-border pt-3 mt-2">
              <Text className="text-base font-bold text-text-primary">{t('customer.total')}</Text>
              <Text className="text-base font-extrabold text-primary">
                {formatOrderAmount(order.totalPrice, currency)}
              </Text>
            </View>

            {isCompleted && (
              <Text className="text-xs text-text-secondary mt-3">{t('customer.paymentCaptured')}</Text>
            )}
            {isActive && order.paymentIntentId != null && (
              <Text className="text-xs text-text-secondary mt-3">
                {t('customer.paymentAuthorized')}
              </Text>
            )}

            {isCompleted && orderHasRating === true && existingRating != null && (
              <View className="flex-row items-center mt-3" style={{ gap: 4 }}>
                <Ionicons name="star" size={14} color={colors.rating} />
                <Text className="text-sm font-semibold text-text-primary">
                  {t('ratings.yourRating', { rating: existingRating.totalRating.toFixed(1) })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {isActive && (
          <View className="bg-primary-50 rounded-[14px] p-4 mb-4">
            <Text className="text-sm font-semibold text-text-primary mb-1">
              {t('customer.collectionInstructions')}
            </Text>
            <Text className="text-sm text-text-secondary">
              {t('customer.collectionInstructionsText')}
            </Text>
          </View>
        )}
      </ScrollView>

      {isActive && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-surface px-4 pt-3 border-t border-border gap-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TouchableOpacity
            onPress={handleConfirmPickup}
            disabled={isConfirming}
            className="bg-primary rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            {isConfirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {t('customer.pickedUp')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCancelVisible(true)}
            disabled={isConfirming}
            className="py-3 items-center"
            activeOpacity={0.7}
          >
            <Text className="text-error font-semibold text-base">{t('customer.cancelOrder')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {canRateOrder && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-surface px-4 pt-3 border-t border-border"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TouchableOpacity
            onPress={() => void openRatingModal(order, { isUpdate: orderHasRating === true })}
            disabled={isLoadingRatingStatus}
            className="bg-primary rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            {isLoadingRatingStatus ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {orderHasRating ? t('ratings.updateRating') : t('ratings.rateOrder')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <CancelOrderModal
        visible={cancelVisible}
        isSubmitting={isCancelling}
        onClose={() => setCancelVisible(false)}
        onConfirm={handleCancel}
      />

      {ratingVendorId != null && ratingOrderId != null && (
        <RatingSubmissionModal
          visible={showRatingModal}
          vendorId={ratingVendorId}
          vendorName={ratingVendorName}
          orderId={ratingOrderId}
          isUpdate={isRatingUpdate}
          initialRatings={
            isRatingUpdate && existingRating != null
              ? {
                  collectionProcessRating: existingRating.collectionProcessRating,
                  qualityRating: existingRating.qualityRating,
                  quantityRating: existingRating.quantityRating,
                  varietyRating: existingRating.varietyRating,
                }
              : null
          }
          onClose={closeRatingModal}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}
    </View>
  );
}
