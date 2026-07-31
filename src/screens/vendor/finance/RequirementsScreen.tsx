import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BackButton from '@/components/BackButton';
import { VendorStackScreenProps } from '@/navigation/types';
import { getStripeOnboardingLink, getStripeRequirements } from '@/services/vendorPaymentService';
import { colors } from '@/theme/colors';
import { StripeRequirement } from '@/types';

type Props = VendorStackScreenProps<'VendorRequirements'>;

type GroupConfig = {
  key: keyof StripeRequirement;
  label: string;
  color: string;
  bg: string;
};

export default function RequirementsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [requirements, setRequirements] = useState<StripeRequirement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const loadRequirements = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getStripeRequirements();
      setRequirements(data);
    } catch {
      setRequirements(null);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequirements();
    }, [loadRequirements]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRequirements(true);
    setIsRefreshing(false);
  }, [loadRequirements]);

  const onCompleteVerification = async () => {
    setIsCompleting(true);
    try {
      const { url } = await getStripeOnboardingLink();
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error'), t('errors.serverError'));
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const groups: GroupConfig[] = [
    { key: 'pastDue', label: t('payment.reqPastDue'), color: colors.error, bg: '#FEE2E2' },
    { key: 'currentlyDue', label: t('payment.reqCurrentlyDue'), color: colors.warning ?? '#FF9500', bg: '#FFF3CD' },
    { key: 'eventuallyDue', label: t('payment.reqEventuallyDue'), color: '#1D6FA4', bg: '#DBEAFE' },
    { key: 'pendingVerification', label: t('payment.reqPending'), color: colors.text.secondary, bg: '#F2F2F7' },
  ];

  const hasUrgent =
    (requirements?.pastDue?.length ?? 0) > 0 ||
    (requirements?.currentlyDue?.length ?? 0) > 0;

  const allEmpty = groups.every((g) => (requirements?.[g.key]?.length ?? 0) === 0);

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
          {t('payment.requirements')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />
        }
      >
        {allEmpty ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: colors.primary[50] ?? '#E8F5E9',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Feather name="check-circle" size={28} color={colors.success} />
            </View>
            <Text style={{ fontSize: 15, color: colors.text.secondary }}>{t('payment.reqAllGood')}</Text>
          </View>
        ) : (
          <>
            {groups.map((group) => {
              const items: string[] = (requirements?.[group.key] as string[] | undefined) ?? [];
              if (items.length === 0) return null;
              return (
                <View key={group.key} style={{ marginTop: 20 }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    marginHorizontal: 16, marginBottom: 6,
                  }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: group.color }} />
                    <Text style={{
                      fontSize: 12, fontWeight: '600', color: group.color,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>
                      {group.label}
                    </Text>
                    <View style={{
                      backgroundColor: group.bg, borderRadius: 10,
                      paddingHorizontal: 6, paddingVertical: 1,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: group.color }}>{items.length}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
                    {items.map((item, idx) => (
                      <View
                        key={item}
                        style={{
                          flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                          paddingHorizontal: 16, paddingVertical: 11,
                          borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                          borderBottomColor: '#F2F2F7',
                        }}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: group.color, marginTop: 7 }} />
                        <Text style={{ flex: 1, fontSize: 13, color: colors.text.primary, lineHeight: 19 }}>
                          {item.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            {hasUrgent && (
              <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                <TouchableOpacity
                  onPress={onCompleteVerification}
                  disabled={isCompleting}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.primary.DEFAULT, borderRadius: 14, paddingVertical: 15,
                    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  }}
                >
                  {isCompleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                        {t('payment.reqCompleteBtn')}
                      </Text>
                      <Feather name="external-link" size={16} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
