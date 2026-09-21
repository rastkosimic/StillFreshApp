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
import BackButton from '@/components/BackButton';
import { CustomerStackScreenProps } from '@/navigation/types';
import { registerCard } from '@/services/allSecurePaymentService';
import { colors } from '@/theme/colors';
import {
  CardRegistrationTimeoutError,
  pollForRegisteredCard,
} from '@/utils/orderPolling';

type Props = CustomerStackScreenProps<'AllSecureCardRegistration'>;

type ScreenPhase = 'loading' | 'webview' | 'polling' | 'error';

export default function AllSecureCardRegistrationScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingStarted = useRef(false);

  const startPolling = useCallback(async () => {
    if (pollingStarted.current) return;
    pollingStarted.current = true;
    setPhase('polling');

    try {
      await pollForRegisteredCard();
      Alert.alert(t('common.success'), t('customer.cardRegistered'), [
        { text: t('common.ok'), onPress: () => navigation.navigate('PaymentMethods') },
      ]);
    } catch (err) {
      const msg =
        err instanceof CardRegistrationTimeoutError
          ? t('customer.cardRegistrationTimeout')
          : t('customer.cardRegistrationFailed');
      setErrorMessage(msg);
      setPhase('error');
      pollingStarted.current = false;
    }
  }, [navigation, t]);

  const loadRegistration = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    pollingStarted.current = false;

    try {
      const res = await registerCard();
      if (!res.redirectUrl) {
        setErrorMessage(t('customer.cardRegistrationFailed'));
        setPhase('error');
        return;
      }
      setRedirectUrl(res.redirectUrl);
      setPhase('webview');
    } catch {
      setErrorMessage(t('customer.cardRegistrationFailed'));
      setPhase('error');
    }
  }, [t]);

  useEffect(() => {
    void loadRegistration();
  }, [loadRegistration]);

  const handleReturn = useCallback(
    (status: AllSecureReturnStatus) => {
      if (status === 'success' || status === 'unknown') {
        // Return URL is informational — card is saved via server callback; poll until it appears.
        void startPolling();
      } else if (status === 'cancel') {
        setErrorMessage(t('customer.cardRegistrationCancelled'));
        setPhase('error');
      } else {
        setErrorMessage(t('customer.cardRegistrationFailed'));
        setPhase('error');
      }
    },
    [startPolling, t],
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3 bg-background border-b border-border">
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="text-lg font-bold text-primary flex-1">
          {t('customer.addCard')}
        </Text>
      </View>

      {phase === 'loading' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      )}

      {phase === 'webview' && redirectUrl != null && (
        <AllSecureRedirectWebView redirectUrl={redirectUrl} onReturn={handleReturn} />
      )}

      {(phase === 'polling' || phase === 'error') && (
        <View className="flex-1 items-center justify-center px-8">
          {phase === 'polling' ? (
            <>
              <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
              <Text className="text-base font-semibold text-text-primary text-center mt-4">
                {t('customer.registeringCard')}
              </Text>
              <Text className="text-sm text-text-secondary text-center mt-2 px-4">
                {t('customer.cardRegistrationPollingHint')}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
              <Text className="text-base font-semibold text-text-primary text-center mt-4">
                {errorMessage}
              </Text>
              <Text className="text-sm text-text-secondary text-center mt-2 px-2">
                {t('customer.cardRegistrationCallbackHint')}
              </Text>
              <TouchableOpacity
                onPress={() => void loadRegistration()}
                className="bg-primary rounded-xl py-4 px-8 mt-6 w-full items-center"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-base">
                  {t('customer.tryAgain')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('PaymentMethods')}
                className="bg-surface border border-border rounded-xl py-4 px-8 mt-3 w-full items-center"
                activeOpacity={0.8}
              >
                <Text className="text-text-primary font-semibold text-base">
                  {t('customer.paymentMethods')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}
