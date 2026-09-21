import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import { CustomerStackScreenProps } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = CustomerStackScreenProps<'CardRegistrationGuide'>;

const STEPS = ['cardGuideStep1', 'cardGuideStep2', 'cardGuideStep3'] as const;

export default function CardRegistrationGuideScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="text-lg font-bold text-primary flex-1">
          {t('customer.cardGuideTitle')}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-14 h-14 rounded-full bg-primary-50 items-center justify-center mb-4 mt-1">
          <Ionicons name="card-outline" size={28} color={colors.primary.DEFAULT} />
        </View>

        <Text className="text-text-primary text-base leading-6 mb-4">
          {t('customer.cardGuideIntro')}
        </Text>

        <View
          className="rounded-xl px-4 py-3.5 flex-row items-start mb-5"
          style={{
            gap: 10,
            backgroundColor: `${colors.warning}1A`,
            borderWidth: 1,
            borderColor: colors.warning,
          }}
        >
          <Ionicons name="alert-circle" size={22} color={colors.warning} />
          <View className="flex-1">
            <Text className="text-text-primary text-sm font-bold mb-1">
              {t('customer.cardGuidePayWarningTitle')}
            </Text>
            <Text className="text-text-primary text-sm leading-5">
              {t('customer.cardGuidePayWarningBody')}
            </Text>
          </View>
        </View>

        <Text className="text-text-primary text-base font-bold mb-3">
          {t('customer.cardGuideStepsTitle')}
        </Text>

        <View className="bg-surface rounded-2xl px-4 py-4 border border-border mb-4">
          {STEPS.map((key, index) => (
            <View
              key={key}
              className={`flex-row items-start gap-3 ${index < STEPS.length - 1 ? 'mb-4' : ''}`}
            >
              <View className="w-7 h-7 rounded-full bg-primary-50 items-center justify-center">
                <Text className="text-primary text-sm font-bold">{index + 1}</Text>
              </View>
              <Text className="flex-1 text-text-primary text-sm leading-5 mt-0.5">
                {t(`customer.${key}`)}
              </Text>
            </View>
          ))}
        </View>

        <Text className="text-text-secondary text-sm leading-5">
          {t('customer.cardGuideReturnNote')}
        </Text>
      </ScrollView>

      <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AllSecureCardRegistration')}
          className="bg-primary rounded-xl py-4 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">
            {t('customer.cardGuideContinue')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
