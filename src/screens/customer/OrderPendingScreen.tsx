import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AllSecureRedirectWebView,
  AllSecureReturnStatus,
} from '@/components/AllSecureRedirectWebView';
import { CustomerStackScreenProps } from '@/navigation/types';
import { getOrders, placeOrder } from '@/services/orderService';
import { useOffersRefreshStore } from '@/stores/offersRefreshStore';
import { useBasketStore } from '@/stores/basketStore';
import { colors } from '@/theme/colors';
import { generateRequestId } from '@/utils/generateRequestId';
import {
  OrderConfirmationTimeoutError,
  PaymentAbortedError,
  PaymentFailedError,
  PaymentStatusTimeoutError,
  pollForNewOrder,
  pollPaymentUntilAuthorized,
} from '@/utils/orderPolling';

type Props = CustomerStackScreenProps<'OrderPending'>;

type Phase =
  | 'submitting'
  | 'polling'
  | 'authentication'
  | 'confirming'
  | 'timeout'
  | 'error';

function isNoCardFailure(reason: string | undefined): boolean {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return lower.includes('no registered card') || lower.includes('no card');
}

export default function OrderPendingScreen({ route, navigation }: Props) {
  const { offerId, quantity } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('submitting');
  const [authRedirectUrl, setAuthRedirectUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string | number>>(new Set());
  const startedRef = useRef(false);
  const flowGenerationRef = useRef(0);
  const flowAbortRef = useRef(false);

  const navigateHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerTabs', params: { screen: 'CustomerHome' } }],
    });
  }, [navigation]);

  const runFlow = useCallback(async () => {
    const generation = ++flowGenerationRef.current;
    flowAbortRef.current = false;
    setPhase('submitting');
    setAuthRedirectUrl(null);
    setErrorMessage(null);

    const isStale = (): boolean =>
      flowAbortRef.current || flowGenerationRef.current !== generation;

    try {
      const before = await getOrders(0, 20);
      const knownIds = new Set(
        before.content
          .filter(
            (o) => String(o.offerId) === String(offerId) && o.status === 'CONFIRMED',
          )
          .map((o) => o.id),
      );
      knownIdsRef.current = knownIds;

      const requestId = generateRequestId();
      const placeResponse = await placeOrder(offerId, quantity, requestId);
      const correlationId = placeResponse.requestId;

      setPhase('polling');

      await pollPaymentUntilAuthorized(
        correlationId,
        (redirectUrl) => {
          if (isStale()) return;
          setAuthRedirectUrl(redirectUrl);
          setPhase('authentication');
        },
        { shouldAbort: isStale },
      );

      if (isStale()) return;

      setAuthRedirectUrl(null);
      setPhase('confirming');

      await pollForNewOrder(offerId, knownIdsRef.current);

      if (isStale()) return;

      useOffersRefreshStore.getState().recordReservation(offerId, quantity);
      void useBasketStore.getState().fetchActiveCount();
      Alert.alert(
        t('customer.reservationPlacedTitle'),
        t('customer.reservationPlacedMessage'),
        [{ text: t('common.ok'), onPress: navigateHome }],
      );
    } catch (err) {
      if (err instanceof PaymentAbortedError || isStale()) {
        return;
      }

      setAuthRedirectUrl(null);

      if (err instanceof PaymentFailedError) {
        setErrorMessage(err.failureReason ?? err.message);
        setPhase('error');
        return;
      }

      if (
        err instanceof PaymentStatusTimeoutError ||
        err instanceof OrderConfirmationTimeoutError
      ) {
        setPhase('timeout');
        return;
      }

      setErrorMessage(t('errors.orderFailed'));
      setPhase('error');
    }
  }, [offerId, quantity, navigateHome, t]);

  const handleAuthReturn = useCallback(
    (status: AllSecureReturnStatus) => {
      if (status === 'cancel') {
        flowAbortRef.current = true;
        setAuthRedirectUrl(null);
        setErrorMessage(t('customer.orderPaymentAuthCancelled'));
        setPhase('error');
        return;
      }

      if (status === 'error') {
        flowAbortRef.current = true;
        setAuthRedirectUrl(null);
        setErrorMessage(t('customer.orderPaymentAuthFailed'));
        setPhase('error');
        return;
      }

      // success or unknown — return URL is informational; keep polling payment status
      setAuthRedirectUrl(null);
      setPhase('polling');
    },
    [t],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runFlow();
  }, [runFlow]);

  const showSpinner =
    phase === 'submitting' || phase === 'polling' || phase === 'confirming';

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {phase === 'authentication' && authRedirectUrl != null && (
        <>
          <View className="flex-row items-center px-4 py-3 gap-3 bg-surface border-b border-border">
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary.DEFAULT} />
            <View className="flex-1">
              <Text className="text-lg font-bold text-text-primary">
                {t('customer.orderPaymentAuthTitle')}
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                {t('customer.orderPaymentAuthDesc')}
              </Text>
            </View>
          </View>
          <AllSecureRedirectWebView
            redirectUrl={authRedirectUrl}
            onReturn={handleAuthReturn}
          />
        </>
      )}

      {phase !== 'authentication' && (
        <View className="flex-1 items-center justify-center px-8">
          {showSpinner && (
            <>
              <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
              <Text className="text-lg font-bold text-text-primary text-center mt-6">
                {phase === 'confirming'
                  ? t('customer.orderConfirmingTitle')
                  : t('customer.orderPendingTitle')}
              </Text>
              <Text className="text-sm text-text-secondary text-center mt-2">
                {phase === 'confirming'
                  ? t('customer.orderConfirmingDesc')
                  : t('customer.orderPendingDesc')}
              </Text>
            </>
          )}

          {(phase === 'timeout' || phase === 'error') && (
            <View className="w-full items-center">
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={colors.error}
                style={{ marginBottom: 8 }}
              />
              <Text className="text-base font-semibold text-text-primary text-center mb-2">
                {phase === 'timeout'
                  ? t('customer.orderPendingTimeout')
                  : errorMessage ?? t('errors.orderFailed')}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  startedRef.current = false;
                  void runFlow();
                }}
                className="bg-primary rounded-xl py-4 w-full items-center mt-4"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-base">
                  {t('customer.tryAgain')}
                </Text>
              </TouchableOpacity>

              {(phase === 'timeout' ||
                (phase === 'error' && isNoCardFailure(errorMessage ?? undefined))) && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('PaymentMethods')}
                  className="bg-surface border border-border rounded-xl py-4 w-full items-center mt-3"
                  activeOpacity={0.8}
                >
                  <Text className="text-text-primary font-semibold text-base">
                    {t('customer.checkPaymentMethod')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="py-4 mt-2"
                activeOpacity={0.7}
              >
                <Text className="text-text-secondary font-semibold">{t('common.back')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
