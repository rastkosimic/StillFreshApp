import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OnboardingStackScreenProps } from '@/navigation/types';
import { getOnboardingStatus } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { OnboardingStatus, OnboardingStatusResponse } from '@/types';

type Props = OnboardingStackScreenProps<'OnboardingFlow'>;

export default function OnboardingFlowScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        setIsLoading(true);
        try {
          const response = await getOnboardingStatus();
          if (cancelled) return;
          setStatus(response);
          routeToStep(response);
        } catch {
          if (!cancelled) {
            Alert.alert(t('common.error'), t('errors.serverError'));
            setIsLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  function enterVendorApp() {
    const user = useAuthStore.getState().user;
    if (user) {
      setUser({ ...user, profileCompleted: true });
    }
  }

  function routeToStep(s: OnboardingStatusResponse) {
    const nextScreen = resolveNextScreen(s);
    if (nextScreen === null) {
      if (s.status === 'COMPLETED' || isProvisionedChainBranch(s)) {
        // Mark profileCompleted so RootNavigator switches to VendorStack.
        enterVendorApp();
        return;
      }
      // PENDING_VERIFICATION — show the waiting screen
      setIsLoading(false);
      return;
    }
    if (nextScreen === 'VendorProfileCompletion') {
      navigation.navigate('VendorProfileCompletion', {
        isUniqueVendor: s.isUniqueVendor,
        currentStatus: s.status,
      });
    } else if (nextScreen === 'PaymentAccountSetup') {
      navigation.navigate('PaymentAccountSetup', { isUniqueVendor: s.isUniqueVendor });
    } else if (
      nextScreen === 'VendorTypeSelection' ||
      nextScreen === 'HeadquartersSetup' ||
      nextScreen === 'BankingModelSelection' ||
      nextScreen === 'OnboardingComplete'
    ) {
      navigation.navigate(nextScreen);
    }
  }

  function resolveNextScreen(s: OnboardingStatusResponse): string | null {
    // HQ-created locations skip the entire onboarding wizard. SHARED uses HQ payouts;
    // INDIVIDUAL sets up bank details from dashboard → Payment settings.
    if (isProvisionedChainBranch(s)) {
      return null;
    }

    const map: Record<OnboardingStatus, string | null> = {
      PENDING_VERIFICATION: null,
      VERIFIED: 'VendorTypeSelection',
      TYPE_SELECTED: s.isUniqueVendor ? 'VendorProfileCompletion' : 'HeadquartersSetup',
      HEADQUARTERS_ADDED: 'VendorProfileCompletion',
      BANKING_SETUP: 'PaymentAccountSetup', // HQ / UNIQUE only reach here
      PAYMENT_CONFIGURED: 'OnboardingComplete',
      COMPLETED: null,
    };
    return map[s.status];
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  // PENDING_VERIFICATION state
  return (
    <View className="flex-1 bg-background px-6 py-12">
      <View
        className="items-center justify-center w-16 h-16 rounded-full mb-6 self-center"
        style={{ backgroundColor: colors.accent[100] }}
      >
        <Text style={{ fontSize: 28 }}>⏳</Text>
      </View>

      <Text className="text-2xl font-bold text-text-primary text-center mb-3">
        {t('vendor.onboarding.pendingTitle')}
      </Text>
      <Text className="text-text-secondary text-sm text-center leading-5 mb-8">
        {t('vendor.onboarding.pendingDesc')}
      </Text>

      <View className="bg-surface rounded-2xl p-4 border border-border mb-8">
        <Text className="text-text-primary text-sm font-semibold mb-3">
          {t('vendor.onboarding.pendingSteps')}
        </Text>
        {(['pendingStep1', 'pendingStep2', 'pendingStep3'] as const).map((key) => (
          <View key={key} className="flex-row items-start gap-2 mb-2">
            <View
              className="w-1.5 h-1.5 rounded-full mt-1.5"
              style={{ backgroundColor: colors.accent.DEFAULT }}
            />
            <Text className="text-text-secondary text-sm flex-1">
              {t(`vendor.onboarding.${key}`)}
            </Text>
          </View>
        ))}
      </View>

      <View
        className="rounded-xl py-4 items-center"
        style={{ backgroundColor: colors.border }}
      >
        <Text className="text-text-secondary font-semibold text-base">
          {t('vendor.onboarding.pendingWaiting')}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => void logout()}
        className="mt-6 items-center"
        activeOpacity={0.7}
      >
        <Text className="text-error text-sm font-semibold">{t('auth.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Non-HQ chain location created/managed by headquarters. Profile, address and banking
 * model already exist — do not show type/banking/payment onboarding steps.
 */
function isProvisionedChainBranch(s: OnboardingStatusResponse): boolean {
  if (s.isChainLocation !== true || s.isHeadquarters === true) {
    return false;
  }
  return s.status !== 'PENDING_VERIFICATION';
}
