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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import { useVendorIdentity } from '@/hooks/useVendorIdentity';
import { VendorStackScreenProps } from '@/navigation/types';
import {
  getChainBankingInfo,
  getChainLocations,
  setupLocationPaymentAccount,
  switchBankingModel,
} from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { BankingModel, ChainBankingInfo, ChainLocation } from '@/types';
import { handleInactiveAccount, mapChainError } from '@/utils/chainErrors';

type Props = VendorStackScreenProps<'VendorBankingModelManagement'>;
type FeatherName = React.ComponentProps<typeof Feather>['name'];

export default function BankingModelManagementScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { identity, isLoading: identityLoading, refresh } = useVendorIdentity();

  const [info, setInfo] = useState<ChainBankingInfo | null>(null);
  const [locations, setLocations] = useState<ChainLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [busyLocationId, setBusyLocationId] = useState<number | null>(null);

  const canSwitch = identity.isHeadquarters && identity.isAdmin;
  const currentModel = info?.bankingModel ?? 'INDIVIDUAL';

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const [banking, locs] = await Promise.all([
          getChainBankingInfo(),
          getChainLocations().catch(() => [] as ChainLocation[]),
        ]);
        setInfo(banking);
        setLocations(locs);
      } catch (error) {
        if (await handleInactiveAccount(error)) return;
        const mapped = mapChainError(error);
        Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }), [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [navigation, t],
  );

  useFocusEffect(
    useCallback(() => {
      if (identityLoading) return;
      // Banking model is headquarters-only — never expose this screen to branch admins.
      if (!identity.isHeadquarters || !identity.isAdmin) {
        Alert.alert(
          t('common.error'),
          t('vendor.chainErrors.switchHqOnly'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
        );
        return;
      }
      void load();
    }, [identityLoading, identity.isHeadquarters, identity.isAdmin, load, navigation, t]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([load(true), refresh()]);
    setIsRefreshing(false);
  }, [load, refresh]);

  const headquarters = locations.find((l) => l.isHeadquarters) ?? null;

  const notReadyLocations = locations.filter(
    (l) => !isPayoutReady(l, currentModel, headquarters),
  );

  const applySwitch = async (model: BankingModel) => {
    setIsSwitching(true);
    try {
      await switchBankingModel(model);
      await Promise.all([load(true), refresh()]);
      Alert.alert(
        t('common.success'),
        t('vendor.bankingModelScreen.switchSuccess', {
          model: t(
            model === 'SHARED'
              ? 'vendor.bankingModelScreen.sharedTitle'
              : 'vendor.bankingModelScreen.individualTitle',
          ),
        }),
      );
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      const mapped = mapChainError(error);
      if (mapped.action === 'goToPaymentSetup') {
        Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('vendor.bankingModelScreen.setupHqCta'),
            onPress: () => navigation.navigate('VendorPaymentSettings'),
          },
        ]);
        return;
      }
      Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }));
    } finally {
      setIsSwitching(false);
    }
  };

  const onSelectModel = (model: BankingModel) => {
    if (!canSwitch || isSwitching || !info) return;
    if (model === currentModel) return;

    if (model === 'SHARED' && !info.headquartersHasAccount) {
      Alert.alert(
        t('vendor.bankingModelScreen.hqAccountRequiredTitle'),
        t('vendor.bankingModelScreen.hqAccountRequiredMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('vendor.bankingModelScreen.setupHqCta'),
            onPress: () => navigation.navigate('VendorPaymentSettings'),
          },
        ],
      );
      return;
    }

    if (model === 'INDIVIDUAL') {
      // Two-step confirmation — switching to INDIVIDUAL invalidates all chain offers.
      Alert.alert(
        t('vendor.bankingModelScreen.switchIndividualTitle'),
        t('vendor.bankingModelScreen.switchIndividualMsg', {
          count: info.totalLocations,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('vendor.bankingModelScreen.continueCta'),
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                t('vendor.bankingModelScreen.switchIndividualConfirmTitle'),
                t('vendor.bankingModelScreen.switchIndividualConfirmMsg', {
                  count: info.totalLocations,
                }),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('vendor.bankingModelScreen.switchCta'),
                    style: 'destructive',
                    onPress: () => void applySwitch('INDIVIDUAL'),
                  },
                ],
              );
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      t('vendor.bankingModelScreen.switchSharedTitle'),
      t('vendor.bankingModelScreen.switchSharedMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendor.bankingModelScreen.switchCta'),
          onPress: () => void applySwitch('SHARED'),
        },
      ],
    );
  };

  const onSetupPayments = (location: ChainLocation) => {
    if (currentModel === 'SHARED') {
      if (identity.isHeadquarters) {
        navigation.navigate('VendorMoRBankDetails');
      } else {
        Alert.alert(
          t('vendor.locations.sharedBankingTitle'),
          t('vendor.locations.sharedBankingPaymentsMsg'),
        );
      }
      return;
    }

    if (location.payoutModel === 'CONNECT') {
      void (async () => {
        setBusyLocationId(location.id);
        try {
          await setupLocationPaymentAccount(location.id);
          await load(true);
          Alert.alert(
            t('vendor.locations.paymentSetupStartedTitle'),
            t('vendor.locations.paymentSetupStartedMsg', {
              locationName: location.locationName,
            }),
          );
        } catch (error) {
          if (await handleInactiveAccount(error)) return;
          const mapped = mapChainError(error);
          Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }));
        } finally {
          setBusyLocationId(null);
        }
      })();
      return;
    }

    navigation.navigate('VendorMoRBankDetails', {
      locationId: location.id,
      locationName: location.locationName,
    });
  };

  const showLoading = isLoading || identityLoading;

  return (
    <View className="flex-1 bg-background">
      <View
        className="bg-surface border-b border-border px-5 pb-3.5 flex-row items-center gap-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <View className="flex-1">
          <Text className="text-[17px] font-semibold text-text-primary">
            {t('vendor.bankingModelScreen.title')}
          </Text>
          {info?.chainName ? (
            <Text className="text-xs text-text-secondary mt-0.5">{info.chainName}</Text>
          ) : null}
        </View>
      </View>

      {showLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.DEFAULT}
            />
          }
        >
          {info ? (
            <View className="mx-4 mt-5 bg-surface rounded-[14px] p-4 border border-border">
              <Text className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1">
                {t('vendor.bankingModelScreen.payoutCoverage')}
              </Text>
              <Text className="text-base font-bold text-text-primary">
                {t('vendor.bankingModelScreen.readyCount', {
                  ready: info.locationsWithPaymentAccounts,
                  total: info.totalLocations,
                })}
              </Text>
              {notReadyLocations.length > 0 ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('VendorChainLocationManagement')}
                  activeOpacity={0.7}
                  className="mt-2"
                >
                  <Text className="text-sm font-semibold text-primary">
                    {t('vendor.bankingModelScreen.viewNotReady', {
                      count: notReadyLocations.length,
                    })}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {!canSwitch ? (
            <View
              className="mx-4 mt-4 rounded-xl px-4 py-3 flex-row gap-2.5 border"
              style={{
                backgroundColor: `${colors.warning}14`,
                borderColor: colors.warning,
              }}
            >
              <Feather name="info" size={16} color={colors.warning} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[13px] leading-[18px] text-text-primary">
                {t('vendor.bankingModelScreen.branchReadOnly')}
              </Text>
            </View>
          ) : null}

          <Text className="mx-4 mt-6 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
            {t('vendor.bankingModelScreen.currentModel')}
          </Text>

          <View className="mx-4">
            <ModelCard
              icon="link"
              title={t('vendor.bankingModelScreen.sharedTitle')}
              description={t('vendor.bankingModelScreen.sharedDesc')}
              activeLabel={t('vendor.bankingModelScreen.activeBadge')}
              selected={currentModel === 'SHARED'}
              disabled={
                !canSwitch ||
                isSwitching ||
                (currentModel !== 'SHARED' && info != null && !info.headquartersHasAccount)
              }
              disabledHint={
                currentModel !== 'SHARED' && info != null && !info.headquartersHasAccount
                  ? t('vendor.bankingModelScreen.sharedDisabledHint')
                  : undefined
              }
              onPress={() => onSelectModel('SHARED')}
            />
            <ModelCard
              icon="credit-card"
              title={t('vendor.bankingModelScreen.individualTitle')}
              description={t('vendor.bankingModelScreen.individualDesc')}
              activeLabel={t('vendor.bankingModelScreen.activeBadge')}
              selected={currentModel === 'INDIVIDUAL'}
              disabled={!canSwitch || isSwitching}
              onPress={() => onSelectModel('INDIVIDUAL')}
            />
          </View>

          {canSwitch && info != null && !info.headquartersHasAccount ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('VendorPaymentSettings')}
              activeOpacity={0.8}
              className="mx-4 mt-2 rounded-xl py-3.5 items-center border border-border bg-surface"
            >
              <Text className="text-primary font-semibold text-[15px]">
                {t('vendor.bankingModelScreen.setupHqCta')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isSwitching ? (
            <View className="mt-4 items-center">
              <ActivityIndicator color={colors.primary.DEFAULT} />
            </View>
          ) : null}

          {currentModel === 'INDIVIDUAL' && notReadyLocations.length > 0 ? (
            <>
              <Text className="mx-4 mt-6 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                {t('vendor.bankingModelScreen.needsSetup')}
              </Text>
              <View className="bg-surface border-y border-border">
                {notReadyLocations.map((location, idx) => (
                  <View
                    key={location.id}
                    className="px-4 py-3.5 flex-row items-center gap-3"
                    style={{
                      borderBottomWidth: idx < notReadyLocations.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View className="w-9 h-9 rounded-full bg-primary-50 items-center justify-center">
                      <Feather
                        name={location.isHeadquarters ? 'home' : 'map-pin'}
                        size={16}
                        color={colors.primary.DEFAULT}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[15px] font-semibold text-text-primary">
                        {location.locationName}
                        {location.isHeadquarters
                          ? ` · ${t('vendor.profile.headquarters')}`
                          : ''}
                      </Text>
                      <Text className="text-xs text-text-secondary mt-0.5">
                        {t('vendor.locations.payoutMissing')}
                      </Text>
                    </View>
                    {canSwitch || location.id === identity.vendorId ? (
                      <TouchableOpacity
                        onPress={() => onSetupPayments(location)}
                        disabled={busyLocationId === location.id}
                        activeOpacity={0.7}
                        className="rounded-full px-3 py-1.5 border"
                        style={{ borderColor: colors.primary.DEFAULT }}
                      >
                        {busyLocationId === location.id ? (
                          <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                        ) : (
                          <Text className="text-xs font-semibold text-primary">
                            {t('vendor.locations.setUpPayments')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {currentModel === 'SHARED' ? (
            <View className="mx-4 mt-5 rounded-xl px-4 py-3 flex-row gap-2.5 bg-primary-50">
              <Feather name="info" size={16} color={colors.primary.DEFAULT} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[13px] leading-[18px] text-text-primary">
                {t('vendor.locations.sharedBankingNote')}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function isPayoutReady(
  location: ChainLocation,
  bankingModel: BankingModel,
  headquarters: ChainLocation | null,
): boolean {
  const subject =
    bankingModel === 'SHARED' && headquarters != null ? headquarters : location;
  return subject.onboardingStatus === 'COMPLETED';
}

function ModelCard({
  icon,
  title,
  description,
  activeLabel,
  selected,
  disabled,
  disabledHint,
  onPress,
}: {
  icon: FeatherName;
  title: string;
  description: string;
  activeLabel: string;
  selected: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled && !selected}
      activeOpacity={0.8}
      className="rounded-2xl p-4 mb-3"
      style={{
        backgroundColor: selected ? colors.primary[50] : colors.surface,
        borderColor: selected ? colors.primary.DEFAULT : colors.border,
        borderWidth: selected ? 2 : 1.5,
        opacity: disabled && !selected ? 0.55 : 1,
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
          {selected ? (
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.text.inverse }} />
          ) : null}
        </View>
        <View
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: selected ? colors.primary[100] : colors.background }}
        >
          <Feather name={icon} size={16} color={colors.primary.DEFAULT} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-text-primary text-sm font-semibold">{title}</Text>
            {selected ? (
              <View className="rounded-full px-2 py-0.5 bg-primary">
                <Text className="text-[10px] font-bold text-white">{activeLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-text-secondary text-xs mt-1 leading-4">{description}</Text>
          {disabledHint ? (
            <Text className="text-xs mt-1.5 leading-4" style={{ color: colors.warning }}>
              {disabledHint}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
