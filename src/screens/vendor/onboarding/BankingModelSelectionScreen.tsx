import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { OnboardingStackScreenProps } from '@/navigation/types';
import { getOnboardingStatus, setBankingModel } from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { BankingModel } from '@/types';

type Props = OnboardingStackScreenProps<'BankingModelSelection'>;

export default function BankingModelSelectionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<BankingModel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getOnboardingStatus();
        if (cancelled) return;
        // Only headquarters (or unique vendors mid-onboarding) may choose the chain banking model.
        // Branch locations inherit the model from HQ and must never reach this screen.
        if (status.isChainLocation === true && status.isHeadquarters !== true) {
          navigation.replace('OnboardingFlow');
          return;
        }
      } catch {
        // Fall through — submit will still fail server-side if unauthorized.
      } finally {
        if (!cancelled) setIsCheckingAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const onSubmit = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await setBankingModel(selected);
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      if (!httpStatus || httpStatus >= 500) {
        Alert.alert(t('common.error'), t('errors.serverError'));
        setIsSubmitting(false);
        return;
      }
      // 4xx = backend rejects re-submission (already set) — navigate forward anyway
    }
    navigation.navigate('OnboardingFlow');
    setIsSubmitting(false);
  };

  if (isCheckingAccess) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-1 px-6 py-10">
        <ProgressBar current={4} total={5} />

        <Text className="text-2xl font-bold text-text-primary mb-2 mt-6">
          {t('vendor.onboarding.bankingTitle')}
        </Text>
        <Text className="text-text-secondary text-sm leading-5 mb-8">
          {t('vendor.onboarding.bankingDesc')}
        </Text>

        <ModelCard
          title={t('vendor.onboarding.bankingShared')}
          description={t('vendor.onboarding.bankingSharedDesc')}
          emoji="🔗"
          selected={selected === 'SHARED'}
          onPress={() => setSelected('SHARED')}
        />

        <ModelCard
          title={t('vendor.onboarding.bankingIndividual')}
          description={t('vendor.onboarding.bankingIndividualDesc')}
          emoji="💳"
          selected={selected === 'INDIVIDUAL'}
          onPress={() => setSelected('INDIVIDUAL')}
        />

        <View className="flex-1" />

        <TouchableOpacity
          className="rounded-xl py-4 items-center mt-4"
          style={{ backgroundColor: selected ? colors.primary.DEFAULT : colors.border }}
          onPress={onSubmit}
          disabled={!selected || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className="font-semibold text-base"
              style={{ color: selected ? '#fff' : colors.text.secondary }}
            >
              {t('common.continue')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('VendorProfileCompletion', { isUniqueVendor: false, currentStatus: 'HEADQUARTERS_ADDED' })}
          activeOpacity={0.7}
          className="items-center py-3 mt-2"
        >
          <Text
            className="font-semibold"
            style={{ color: colors.text.secondary, fontSize: 15 }}
          >
            {t('common.back')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="flex-1 h-1 rounded-full"
          style={{
            backgroundColor:
              i < current - 1
                ? colors.primary.DEFAULT
                : i === current - 1
                  ? colors.accent.DEFAULT
                  : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function ModelCard({
  title,
  description,
  emoji,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  emoji: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="rounded-2xl p-4 mb-3"
      style={{
        backgroundColor: selected ? colors.primary[50] : colors.surface,
        borderColor: selected ? colors.primary.DEFAULT : colors.border,
        borderWidth: selected ? 2 : 1.5,
      }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="w-5 h-5 rounded-full border-2 items-center justify-center mt-0.5"
          style={{
            borderColor: selected ? colors.primary.DEFAULT : colors.border,
            backgroundColor: selected ? colors.primary.DEFAULT : 'transparent',
          }}
        >
          {selected && <View className="w-2 h-2 rounded-full bg-white" />}
        </View>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <View className="flex-1">
          <Text className="text-text-primary text-sm font-semibold">{title}</Text>
          <Text className="text-text-secondary text-xs mt-1 leading-4">{description}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
