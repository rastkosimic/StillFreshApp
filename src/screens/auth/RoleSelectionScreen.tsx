import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import { AuthStackScreenProps } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = AuthStackScreenProps<'RoleSelection'>;

export default function RoleSelectionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
    >
      {/* Back to login */}
      <BackButton onPress={() => navigation.navigate('Login')} className="mb-8" />

      {/* Header */}
      <View className="mb-10 items-center">
        <BrandLogo variant="stacked" width={64} className="mb-3" />
        <Text className="text-text-primary text-xl font-bold mt-3 text-center">
          {t('auth.roleSelection')}
        </Text>
      </View>

      {/* Customer card */}
      <TouchableOpacity
        className="bg-surface border-2 border-primary rounded-2xl p-6 mb-4"
        onPress={() => navigation.navigate('CustomerRegister')}
        activeOpacity={0.8}
      >
        <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
          <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
            <Ionicons name="person" size={24} color={colors.text.inverse} />
          </View>
          <Text className="text-text-primary text-lg font-bold">{t('auth.beCustomer')}</Text>
        </View>
        <Text className="text-text-secondary text-sm">{t('auth.beCustomerDesc')}</Text>
      </TouchableOpacity>

      {/* Vendor card */}
      <TouchableOpacity
        className="bg-surface border border-border rounded-2xl p-6 mb-4"
        onPress={() => navigation.navigate('VendorRegister')}
        activeOpacity={0.8}
      >
        <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
          <View className="w-12 h-12 rounded-full bg-primary-50 items-center justify-center">
            <Ionicons name="storefront-outline" size={24} color={colors.primary.DEFAULT} />
          </View>
          <Text className="text-text-primary text-lg font-bold">{t('auth.beVendor')}</Text>
        </View>
        <Text className="text-text-secondary text-sm">{t('auth.beVendorDesc')}</Text>
      </TouchableOpacity>

      {/* Sign in link */}
      <View className="flex-row justify-center mt-auto">
        <Text className="text-text-secondary text-sm">{t('auth.alreadyHaveAccount')} </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text className="text-primary text-sm font-semibold">{t('auth.signIn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
