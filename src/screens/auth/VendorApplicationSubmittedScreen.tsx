import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import BrandLogo from '@/components/BrandLogo';
import { AuthStackScreenProps } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = AuthStackScreenProps<'VendorApplicationSubmitted'>;

export default function VendorApplicationSubmittedScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-background px-6 py-12 items-center justify-center">

      <BrandLogo variant="icon" width={80} height={80} className="mb-6" />

      {/* Title */}
      <Text className="text-2xl font-bold text-text-primary text-center mb-3">
        {t('auth.applicationSubmittedTitle')}
      </Text>

      {/* Description */}
      <Text className="text-text-secondary text-sm text-center leading-5 mb-8">
        {t('auth.applicationSubmittedDesc')}
      </Text>

      {/* What happens next */}
      <View className="bg-surface rounded-2xl p-5 border border-border w-full mb-10">
        <Text className="text-text-primary text-sm font-semibold mb-3">
          {t('auth.applicationNextSteps')}
        </Text>
        {(['applicationStep1', 'applicationStep2', 'applicationStep3'] as const).map((key) => (
          <View key={key} className="flex-row items-start gap-2 mb-2">
            <View
              className="w-1.5 h-1.5 rounded-full mt-1.5"
              style={{ backgroundColor: colors.accent.DEFAULT }}
            />
            <Text className="text-text-secondary text-sm flex-1">
              {t(`auth.${key}`)}
            </Text>
          </View>
        ))}
      </View>

      {/* Back to login */}
      <TouchableOpacity
        className="w-full rounded-xl py-4 items-center"
        style={{ backgroundColor: colors.primary.DEFAULT }}
        onPress={() => navigation.navigate('Login')}
        activeOpacity={0.8}
      >
        <Text className="text-white font-semibold text-base">
          {t('auth.backToLogin')}
        </Text>
      </TouchableOpacity>

    </View>
  );
}
