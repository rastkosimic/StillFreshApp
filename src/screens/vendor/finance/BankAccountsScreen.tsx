import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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

import BackButton from '@/components/BackButton';
import { VendorStackScreenProps } from '@/navigation/types';
import {
  deleteBankAccount,
  getStripeBankAccounts,
  setDefaultBankAccount,
} from '@/services/vendorPaymentService';
import { colors } from '@/theme/colors';
import { StripeBankAccount } from '@/types';

type Props = VendorStackScreenProps<'VendorBankAccounts'>;

export default function BankAccountsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<StripeBankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAccounts = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getStripeBankAccounts();
      setAccounts(data);
    } catch {
      setAccounts([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAccounts(true);
    setIsRefreshing(false);
  }, [loadAccounts]);

  const onSetDefault = (account: StripeBankAccount) => {
    Alert.alert(
      t('payment.setDefault'),
      `${account.bankName} ···${account.last4}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: async () => {
            setBusyId(account.id);
            try {
              await setDefaultBankAccount(account.id, account.currency);
              await loadAccounts(true);
            } catch {
              Alert.alert(t('common.error'), t('errors.serverError'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const onDelete = (account: StripeBankAccount) => {
    Alert.alert(
      t('payment.deleteAccount'),
      t('payment.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(account.id);
            try {
              await deleteBankAccount(account.id);
              await loadAccounts(true);
            } catch {
              Alert.alert(t('common.error'), t('errors.serverError'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.surface,
        paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text.primary }}>
          {t('payment.bankAccounts')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />
        }
      >
        {accounts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
            <Feather name="credit-card" size={40} color={colors.border} />
            <Text style={{ fontSize: 15, color: colors.text.secondary }}>{t('payment.emptyBankAccounts')}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            {accounts.map((account, idx) => (
              <View
                key={account.id}
                style={{
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: idx < accounts.length - 1 ? 1 : 0,
                  borderBottomColor: '#F2F2F7',
                  opacity: busyId === account.id ? 0.5 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 8,
                    backgroundColor: colors.background,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: colors.border,
                  }}>
                    <Feather name="credit-card" size={18} color={colors.text.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text.primary }}>
                        {account.bankName}
                      </Text>
                      {account.isDefault && (
                        <View style={{
                          backgroundColor: colors.primary[50] ?? '#E8F5E9',
                          borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary.DEFAULT }}>
                            {t('payment.defaultBadge')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2 }}>
                      ···{account.last4} · {account.currency.toUpperCase()} · {account.country}
                    </Text>
                  </View>
                  {busyId === account.id && (
                    <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                  )}
                </View>

                {/* Actions */}
                {!account.isDefault && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => onSetDefault(account)}
                      disabled={busyId !== null}
                      activeOpacity={0.7}
                      style={{
                        flex: 1, paddingVertical: 8, borderRadius: 8,
                        borderWidth: 1, borderColor: colors.primary.DEFAULT,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary.DEFAULT }}>
                        {t('payment.setDefault')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(account)}
                      disabled={busyId !== null}
                      activeOpacity={0.7}
                      style={{
                        paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8,
                        borderWidth: 1, borderColor: colors.error,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.error }}>
                        {t('common.delete')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
