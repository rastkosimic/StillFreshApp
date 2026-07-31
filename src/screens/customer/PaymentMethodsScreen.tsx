import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { CustomerStackScreenProps } from '@/navigation/types';
import { AllSecurePaymentMethod } from '@/types';
import { colors } from '@/theme/colors';

type Props = CustomerStackScreenProps<'PaymentMethods'>;

function CardRow({
  method,
  onDelete,
}: {
  method: AllSecurePaymentMethod;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const brand = (method.cardBrand ?? 'card').toUpperCase();
  const expiry =
    method.cardExpMonth != null && method.cardExpYear != null
      ? `${String(method.cardExpMonth).padStart(2, '0')}/${String(method.cardExpYear).slice(-2)}`
      : '';

  const handleDelete = () => {
    Alert.alert(t('customer.deleteCard'), t('customer.deleteCardConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => onDelete(method.paymentMethodId),
      },
    ]);
  };

  return (
    <View className="flex-row items-center py-4 px-4 border-b border-border">
      <View className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center mr-3">
        <Ionicons name="card-outline" size={20} color={colors.primary.DEFAULT} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary">
          {brand} •••• {method.cardLast4 ?? '????'}
        </Text>
        {expiry.length > 0 && (
          <Text className="text-xs text-text-secondary mt-0.5">{expiry}</Text>
        )}
      </View>
      {method.isDefault && (
        <View className="bg-primary-50 rounded-full px-2 py-0.5 mr-2">
          <Text className="text-xs font-semibold text-primary">{t('customer.defaultCard')}</Text>
        </View>
      )}
      <TouchableOpacity onPress={handleDelete} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

export default function PaymentMethodsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { methods, isLoading, refresh, deleteMethod } = usePaymentMethods();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMethod(id);
    } catch {
      Alert.alert(t('common.error'), t('errors.serverError'));
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="text-lg font-bold text-text-primary flex-1">
          {t('customer.paymentMethods')}
        </Text>
      </View>

      {isLoading && methods.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.DEFAULT}
            />
          }
        >
          {methods.length === 0 ? (
            <View className="items-center py-16 px-6">
              <Ionicons name="leaf-outline" size={56} color={colors.primary[200]} />
              <Text className="text-base font-semibold text-text-primary text-center mt-4">
                {t('customer.noPaymentMethods')}
              </Text>
              <Text className="text-sm text-text-secondary text-center mt-2">
                {t('customer.noPaymentMethodsDesc')}
              </Text>
            </View>
          ) : (
            <View
              className="bg-surface rounded-[14px] overflow-hidden mb-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              {methods.map((m) => (
                <CardRow key={m.paymentMethodId} method={m} onDelete={handleDelete} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <View className="px-4 pb-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AllSecureCardRegistration')}
          className="bg-primary rounded-xl py-4 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">{t('customer.addCard')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
