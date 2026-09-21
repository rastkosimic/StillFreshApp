import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BackButton from '@/components/BackButton';
import { VendorStackScreenProps } from '@/navigation/types';
import { getStripeOnboardingLink, handleStripeReturn } from '@/services/vendorPaymentService';
import { colors } from '@/theme/colors';

type Props = VendorStackScreenProps<'VendorStripeOnboarding'>;

const STRIPE_RETURN_URL = 'stillfresh://vendors/stripe/return';

export default function StripeOnboardingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    getStripeOnboardingLink()
      .then((res) => setOnboardingUrl(res.url))
      .catch(() => setOnboardingUrl(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for the deep link return from Stripe
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      if (url.startsWith(STRIPE_RETURN_URL)) {
        try {
          await handleStripeReturn();
          Alert.alert(
            t('common.success'),
            t('vendor.onboarding.paymentConnectStep3'),
            [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
          );
        } catch {
          Alert.alert(t('common.error'), t('errors.serverError'));
        }
      }
    });
    return () => subscription.remove();
  }, [navigation, t]);

  const openStripe = async () => {
    if (!onboardingUrl) return;
    setIsOpening(true);
    try {
      await Linking.openURL(onboardingUrl);
    } catch {
      Alert.alert(t('common.error'), t('errors.serverError'));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.background,
        paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.primary.DEFAULT }}>
          {t('payment.setupAction')}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stripe logo area */}
          <View style={{
            backgroundColor: colors.surface, borderRadius: 14,
            padding: 20, alignItems: 'center', marginBottom: 20,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: '#635BFF',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 24, color: '#fff', fontWeight: '800' }}>S</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 4 }}>
              {t('payment.modelConnect')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.text.secondary, textAlign: 'center' }}>
              {t('vendor.onboarding.paymentConnectDesc')}
            </Text>
          </View>

          {/* Steps */}
          <View style={{
            backgroundColor: colors.surface, borderRadius: 14,
            padding: 16, marginBottom: 20,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{
              fontSize: 12, fontWeight: '600', color: colors.text.secondary,
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
            }}>
              {t('vendor.onboarding.paymentConnectHow')}
            </Text>
            {[
              t('vendor.onboarding.paymentConnectStep1'),
              t('vendor.onboarding.paymentConnectStep2'),
              t('vendor.onboarding.paymentConnectStep3'),
            ].map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: colors.primary.DEFAULT,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 20 }}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Security note */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 28, alignItems: 'flex-start' }}>
            <Feather name="shield" size={14} color={colors.text.secondary} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.text.secondary }}>
              {t('vendor.onboarding.paymentSecurityNote')}
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={openStripe}
            disabled={!onboardingUrl || isOpening}
            activeOpacity={0.85}
            style={{
              backgroundColor: !onboardingUrl ? colors.border : colors.primary.DEFAULT,
              borderRadius: 14, paddingVertical: 15,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
          >
            {isOpening ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {t('vendor.onboarding.paymentConnectBtn')}
                </Text>
                <Feather name="external-link" size={16} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
