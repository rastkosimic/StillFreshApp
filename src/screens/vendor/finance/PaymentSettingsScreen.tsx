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
import { useVendorIdentity } from '@/hooks/useVendorIdentity';
import { VendorStackScreenProps } from '@/navigation/types';
import { getPaymentStatus } from '@/services/vendorPaymentService';
import { colors } from '@/theme/colors';
import { PaymentStatus } from '@/types';

type Props = VendorStackScreenProps<'VendorPaymentSettings'>;
type FeatherName = React.ComponentProps<typeof Feather>['name'];

export default function PaymentSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { identity, isLoading: identityLoading } = useVendorIdentity();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getPaymentStatus();
      if (data.payoutModel === 'MOR') {
        // MoR vendors skip this hub entirely — replace so back goes to dashboard
        navigation.replace('VendorMoRBankDetails');
        return;
      }
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (identityLoading) return;

      // On SHARED banking, only headquarters manages payouts for the chain.
      const isSharedBranch =
        identity.isChainLocation &&
        !identity.isHeadquarters &&
        identity.usesSharedPaymentAccount;
      if (isSharedBranch) {
        Alert.alert(
          t('vendor.locations.sharedBankingTitle'),
          t('vendor.locations.sharedBankingPaymentsMsg'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
        );
        return;
      }

      void loadStatus();
    }, [
      identityLoading,
      identity.isChainLocation,
      identity.isHeadquarters,
      identity.usesSharedPaymentAccount,
      loadStatus,
      navigation,
      t,
    ]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStatus(true);
    setIsRefreshing(false);
  }, [loadStatus]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const isMoR = status?.payoutModel === 'MOR';
  const isReady = status?.isReady === true;
  const isPending = status?.hasAccount === true && !isReady;

  const statusLabel = isReady
    ? t('payment.statusReady')
    : isPending
      ? t('payment.statusPending')
      : t('payment.statusNotSetup');

  const statusColor = isReady
    ? colors.success
    : isPending
      ? (colors.warning ?? '#FF9500')
      : colors.text.secondary;

  const modelLabel = isMoR ? t('payment.modelMor') : t('payment.modelConnect');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />
      }
    >
      {/* Header */}
      <View style={{
        backgroundColor: colors.background,
        paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.primary.DEFAULT }}>
          {t('payment.settingsTitle')}
        </Text>
      </View>

      {/* Status card */}
      <View style={{
        marginHorizontal: 16, marginTop: 20,
        backgroundColor: colors.surface,
        borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, color: colors.text.secondary }}>{modelLabel}</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: `${statusColor}18`,
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
          </View>
        </View>
        {status?.message ? (
          <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 8 }}>
            {status.message}
          </Text>
        ) : null}
      </View>

      {/* CONNECT actions */}
      {!isMoR && (
        <>
          <SectionLabel title="Stripe Connect" />
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            {!isReady && (
              <ListRow
                icon="external-link"
                label={t('payment.setupAction')}
                onPress={() => navigation.navigate('VendorStripeOnboarding')}
              />
            )}
            <ListRow
              icon="credit-card"
              label={t('payment.bankAccounts')}
              onPress={() => navigation.navigate('VendorBankAccounts')}
            />
            <ListRow
              icon="user"
              label={t('payment.accountDetails')}
              onPress={() => navigation.navigate('VendorAccountDetails')}
            />
            <ListRow
              icon="alert-circle"
              label={t('payment.requirements')}
              onPress={() => navigation.navigate('VendorRequirements')}
              isLast
            />
          </View>
        </>
      )}

      {/* MoR actions */}
      {isMoR && (
        <>
          <SectionLabel title={t('payment.modelMor')} />
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            <ListRow
              icon="grid"
              label={t('payment.morBankDetails')}
              onPress={() => navigation.navigate('VendorMoRBankDetails')}
              isLast
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text style={{
      fontSize: 12, fontWeight: '600', color: colors.text.secondary,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginTop: 24, marginBottom: 6, marginHorizontal: 16,
    }}>
      {title}
    </Text>
  );
}

function ListRow({
  icon,
  label,
  onPress,
  isLast,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 16, gap: 14,
        backgroundColor: colors.surface,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#F2F2F7',
      }}
    >
      <Feather name={icon} size={20} color={colors.text.secondary} />
      <Text style={{ flex: 1, fontSize: 15, color: colors.text.primary }}>{label}</Text>
      <Feather name="chevron-right" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}
