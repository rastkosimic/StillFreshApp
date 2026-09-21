import { Feather, Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BackButton from '@/components/BackButton';
import { VendorStackScreenProps } from '@/navigation/types';
import { getStripeAccount } from '@/services/vendorPaymentService';
import { colors } from '@/theme/colors';

type Props = VendorStackScreenProps<'VendorAccountDetails'>;

export default function AccountDetailsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [account, setAccount] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAccount = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getStripeAccount();
      setAccount(data);
    } catch {
      setAccount(null);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccount();
    }, [loadAccount]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAccount(true);
    setIsRefreshing(false);
  }, [loadAccount]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const chargesEnabled = account?.chargesEnabled === true;
  const payoutsEnabled = account?.payoutsEnabled === true;
  const showWarning = !chargesEnabled || !payoutsEnabled;

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
          {t('payment.accountDetails')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 40,
          flexGrow: account ? undefined : 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />
        }
      >
        {/* Warning card */}
        {showWarning && account && (
          <TouchableOpacity
            onPress={() => navigation.navigate('VendorRequirements')}
            activeOpacity={0.85}
            style={{
              margin: 16, borderRadius: 12, padding: 14,
              backgroundColor: '#FFF3CD',
              borderWidth: 1.5, borderColor: colors.warning ?? '#FF9500',
              flexDirection: 'row', alignItems: 'flex-start', gap: 10,
            }}
          >
            <Ionicons name="warning-outline" size={18} color="#7d4e00" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#7d4e00', lineHeight: 18 }}>
                {t('payment.accountWarning')}
              </Text>
              <Text style={{ fontSize: 12, color: '#7d4e00', marginTop: 4, fontWeight: '600' }}>
                {t('payment.requirements')} →
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {account ? (
          <View style={{ marginTop: showWarning ? 0 : 16, backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            {[
              { label: 'ID', value: String(account.id ?? '') },
              { label: 'Email', value: String(account.email ?? '') },
              { label: t('vendor.profile.country'), value: String(account.country ?? '') },
              { label: t('common.currency'), value: String(account.currency ?? '').toUpperCase() },
              { label: t('payment.chargesEnabled'), value: chargesEnabled ? '✓' : '✗' },
              { label: t('payment.payoutsEnabled'), value: payoutsEnabled ? '✓' : '✗' },
            ]
              .filter((row) => row.value && row.value !== 'undefined' && row.value !== '')
              .map((row, idx, arr) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                    borderBottomColor: '#F2F2F7',
                  }}
                >
                  <Text style={{ fontSize: 14, color: colors.text.secondary, width: 130 }}>{row.label}</Text>
                  <Text style={{
                    flex: 1, fontSize: 14,
                    color: row.value === '✗' ? colors.error : row.value === '✓' ? colors.success : colors.text.primary,
                    fontWeight: (row.value === '✓' || row.value === '✗') ? '700' : '400',
                  }}>
                    {row.value}
                  </Text>
                </View>
              ))}
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Feather name="user-x" size={40} color={colors.border} />
            <Text style={{ fontSize: 15, color: colors.text.secondary }}>{t('errors.notFound')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
