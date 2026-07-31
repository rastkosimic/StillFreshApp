import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingStackScreenProps } from '@/navigation/types';
import { completeOnboarding } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

type Props = OnboardingStackScreenProps<'OnboardingComplete'>;

const COMPLETE_ITEMS = [
  'completeItem1',
  'completeItem2',
  'completeItem3',
  'completeItem4',
] as const;

export default function OnboardingCompleteScreen(_props: Props) {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onComplete = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding();
      // Setting profileCompleted=true causes RootNavigator to switch to VendorTabs
      if (user) {
        await setUser({ ...user, profileCompleted: true });
      }
    } catch {
      Alert.alert(t('common.error'), t('errors.serverError'));
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-1 px-6 py-10 items-center">
        {/* All-done progress — all dots filled */}
        <View className="flex-row gap-1 w-full mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={i}
              className="flex-1 h-1 rounded-full"
              style={{ backgroundColor: colors.primary.DEFAULT }}
            />
          ))}
        </View>

        {/* Success icon */}
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: colors.primary.DEFAULT }}
        >
          <Text style={{ fontSize: 36 }}>✅</Text>
        </View>

        <Text className="text-2xl font-bold text-text-primary text-center mb-3">
          {t('vendor.onboarding.completeTitle')}
        </Text>
        <Text className="text-text-secondary text-sm text-center leading-5 mb-8">
          {t('vendor.onboarding.completeDesc')}
        </Text>

        {/* What you can do card */}
        <View className="bg-surface rounded-2xl p-5 border border-border w-full mb-8">
          <Text className="text-text-primary text-sm font-semibold mb-4">
            🚀 {t('vendor.onboarding.completeWhatNext')}
          </Text>
          {COMPLETE_ITEMS.map((key) => (
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

        <View className="flex-1" />

        <TouchableOpacity
          className="rounded-xl py-4 items-center w-full"
          style={{ backgroundColor: colors.primary.DEFAULT }}
          onPress={onComplete}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {t('vendor.onboarding.completeBtn')}
            </Text>
          )}
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
