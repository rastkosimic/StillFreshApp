import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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
  removeChainLocation,
  setupLocationPaymentAccount,
} from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { BankingModel, ChainLocation } from '@/types';
import { handleInactiveAccount, mapChainError } from '@/utils/chainErrors';

type Props = VendorStackScreenProps<'VendorChainLocationManagement'>;
type FeatherName = React.ComponentProps<typeof Feather>['name'];

export default function ChainLocationManagementScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { identity } = useVendorIdentity();

  const [locations, setLocations] = useState<ChainLocation[]>([]);
  const [bankingModel, setBankingModel] = useState<BankingModel>('INDIVIDUAL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAtLocationLimit, setIsAtLocationLimit] = useState(false);
  const [busyLocationId, setBusyLocationId] = useState<number | null>(null);
  const [menuTarget, setMenuTarget] = useState<ChainLocation | null>(null);

  const isHeadquarters = identity.isHeadquarters;
  const ownLocationId = identity.vendorId;

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [rows, banking] = await Promise.all([
        getChainLocations(),
        // Non-chain accounts get a 400 here; the location list is the source of truth.
        getChainBankingInfo().catch(() => null),
      ]);
      setLocations(rows);
      if (banking) setBankingModel(banking.bankingModel);
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      setLocations([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The add form reports the server-side cap back here so the button stays disabled for the
  // rest of the session rather than only for the one attempt that hit it.
  const limitReachedParam = route.params?.locationLimitReached === true;
  useEffect(() => {
    if (limitReachedParam) setIsAtLocationLimit(true);
  }, [limitReachedParam]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(true);
    setIsRefreshing(false);
  }, [load]);

  // Headquarters first, everything else alphabetical.
  const sorted = useMemo(
    () =>
      [...locations].sort((a, b) => {
        if (a.isHeadquarters !== b.isHeadquarters) return a.isHeadquarters ? -1 : 1;
        return (a.locationName ?? '').localeCompare(b.locationName ?? '');
      }),
    [locations],
  );

  const headquarters = sorted.find((l) => l.isHeadquarters) ?? null;
  const notReadyCount = sorted.filter(
    (l) => !isPayoutReady(l, bankingModel, headquarters),
  ).length;

  const openEditor = (location: ChainLocation) => {
    setMenuTarget(null);
    // The update endpoint rejects headquarters outright — its own profile screen owns it.
    if (location.isHeadquarters) {
      navigation.navigate('VendorEditProfile');
      return;
    }
    navigation.navigate('VendorLocationForm', { location });
  };

  const onSetupPayments = (location: ChainLocation) => {
    setMenuTarget(null);

    // SHARED: every location is paid through HQ — no per-location bank form.
    if (bankingModel === 'SHARED') {
      if (isHeadquarters) {
        navigation.navigate('VendorMoRBankDetails');
      } else {
        Alert.alert(
          t('vendor.locations.sharedBankingTitle'),
          t('vendor.locations.sharedBankingPaymentsMsg'),
        );
      }
      return;
    }

    // CONNECT: initialise the Stripe shell; hosted onboarding is a follow-up.
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

    // MoR (Serbia default): open the bank form and save via
    // PUT /vendors/chain/locations/{id}/mor/bank-details — not init-only.
    navigation.navigate('VendorMoRBankDetails', {
      locationId: location.id,
      locationName: location.locationName,
    });
  };

  const onRemove = (location: ChainLocation) => {
    setMenuTarget(null);
    Alert.alert(
      t('vendor.locations.removeTitle', { locationName: location.locationName }),
      t('vendor.locations.removeMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendor.locations.removeCta'),
          style: 'destructive',
          onPress: () => void confirmRemove(location),
        },
      ],
    );
  };

  const confirmRemove = async (location: ChainLocation) => {
    setBusyLocationId(location.id);
    try {
      await removeChainLocation(location.id);
      await load(true);
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      const mapped = mapChainError(error);
      if (mapped.action === 'refetchLocations') await load(true);
      Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }));
    } finally {
      setBusyLocationId(null);
    }
  };

  const onAddLocation = () => {
    navigation.navigate('VendorLocationForm', {
      defaultCountry: identity.profile?.country,
    });
  };

  return (
    <View className="flex-1 bg-background">
      <View
        className="bg-surface border-b border-border px-5 pb-3.5 flex-row items-center gap-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <View className="flex-1">
          <Text className="text-[17px] font-semibold text-text-primary">
            {t('vendor.locations.title')}
          </Text>
          {identity.chainName ? (
            <Text className="text-xs text-text-secondary mt-0.5">{identity.chainName}</Text>
          ) : null}
        </View>
      </View>

      {isLoading ? (
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
          {notReadyCount > 0 && (
            <View
              className="mx-4 mt-4 rounded-xl px-4 py-3 flex-row gap-2.5"
              style={{ backgroundColor: `${colors.warning}14` }}
            >
              <Feather name="alert-circle" size={16} color={colors.warning} />
              <Text className="text-xs leading-4 flex-1 text-text-primary">
                {t('vendor.locations.notReadyBanner', { count: notReadyCount })}
              </Text>
            </View>
          )}

          {bankingModel === 'SHARED' && (
            <View
              className="mx-4 mt-3 rounded-xl px-4 py-3 flex-row gap-2.5"
              style={{ backgroundColor: colors.primary[50] }}
            >
              <Feather name="info" size={16} color={colors.primary.DEFAULT} />
              <Text className="text-xs leading-4 flex-1 text-text-primary">
                {t('vendor.locations.sharedBankingNote')}
              </Text>
            </View>
          )}

          <Text className="text-xs text-text-secondary font-semibold uppercase tracking-wide mt-5 mb-1.5 mx-5">
            {t('vendor.locations.countLabel', { count: sorted.length })}
          </Text>

          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            <View className="px-4 gap-2.5">
              {sorted.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  isPayoutReady={isPayoutReady(location, bankingModel, headquarters)}
                  isBusy={busyLocationId === location.id}
                  onOpenMenu={() => setMenuTarget(location)}
                  onSetupPayments={() => void onSetupPayments(location)}
                />
              ))}
            </View>
          )}

          {/* A branch admin never sees this — the request would fail with a 400 telling
              them to contact headquarters. */}
          {isHeadquarters && (
            <View className="px-4 mt-5">
              <TouchableOpacity
                className="rounded-xl py-4 items-center flex-row justify-center gap-2"
                style={{
                  backgroundColor: isAtLocationLimit ? colors.border : colors.primary.DEFAULT,
                }}
                activeOpacity={0.8}
                disabled={isAtLocationLimit}
                onPress={onAddLocation}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={isAtLocationLimit ? colors.text.secondary : '#fff'}
                />
                <Text
                  className="font-semibold text-base"
                  style={{ color: isAtLocationLimit ? colors.text.secondary : '#fff' }}
                >
                  {t('vendor.addLocation')}
                </Text>
              </TouchableOpacity>
              {isAtLocationLimit && (
                <Text className="text-xs text-error text-center mt-2">
                  {t('vendor.chainErrors.locationLimit')}
                </Text>
              )}
            </View>
          )}

          {!isHeadquarters && (
            <View className="px-4 mt-5">
              <View className="bg-surface rounded-xl border border-border px-4 py-3 flex-row gap-2.5">
                <Feather name="info" size={16} color={colors.text.secondary} />
                <Text className="text-xs leading-4 flex-1 text-text-secondary">
                  {t('vendor.locations.branchNote')}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <LocationActionSheet
        location={menuTarget}
        canRemove={
          menuTarget != null &&
          isHeadquarters &&
          !menuTarget.isHeadquarters &&
          menuTarget.id !== ownLocationId
        }
        canEdit={
          menuTarget != null &&
          (isHeadquarters || menuTarget.id === ownLocationId)
        }
        onClose={() => setMenuTarget(null)}
        onEdit={() => menuTarget && openEditor(menuTarget)}
        onWorkers={() => {
          if (!menuTarget) return;
          setMenuTarget(null);
          navigation.navigate('VendorWorkerManagement', {
            locationId: menuTarget.id,
            locationName: menuTarget.locationName,
          });
        }}
        onPayments={() => menuTarget && void onSetupPayments(menuTarget)}
        onRemove={() => menuTarget && onRemove(menuTarget)}
      />
    </View>
  );
}

// ── Payout readiness ──────────────────────────────────────────────────────────

/**
 * A location can publish offers once it has a payout destination. On the SHARED banking
 * model every location is paid through headquarters, so readiness is headquarters' readiness
 * rather than the branch's own.
 */
function isPayoutReady(
  location: ChainLocation,
  bankingModel: BankingModel,
  headquarters: ChainLocation | null,
): boolean {
  const subject =
    bankingModel === 'SHARED' && headquarters != null ? headquarters : location;
  return subject.onboardingStatus === 'COMPLETED';
}

// ── Rows ──────────────────────────────────────────────────────────────────────

interface LocationCardProps {
  location: ChainLocation;
  isPayoutReady: boolean;
  isBusy: boolean;
  onOpenMenu: () => void;
  onSetupPayments: () => void;
}

function LocationCard({
  location,
  isPayoutReady: isReady,
  isBusy,
  onOpenMenu,
  onSetupPayments,
}: LocationCardProps) {
  const { t } = useTranslation();
  const isInactive = location.status === 'INACTIVE';

  return (
    <View
      className="bg-surface rounded-[14px] p-4"
      style={{
        opacity: isInactive ? 0.6 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-base font-bold text-text-primary">
              {location.locationName}
            </Text>
            {location.isHeadquarters && (
              <Chip label={t('vendor.headquarters')} tone="primary" />
            )}
            <Chip
              label={t(`vendor.status.${location.status ?? 'ACTIVE'}`)}
              tone={isInactive ? 'muted' : 'success'}
            />
          </View>
          <Text className="text-xs text-text-secondary mt-1" numberOfLines={2}>
            {location.address}
            {location.zipCode ? `, ${location.zipCode}` : ''}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
            {location.email}
          </Text>
        </View>

        {isBusy ? (
          <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
        ) : (
          <TouchableOpacity onPress={onOpenMenu} hitSlop={8} activeOpacity={0.7}>
            <Feather name="more-vertical" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Persistent, not a one-off toast: until this clears, the location cannot sell. */}
      {!isReady && !isInactive && (
        <TouchableOpacity
          onPress={onSetupPayments}
          activeOpacity={0.8}
          className="rounded-xl px-3 py-2.5 mt-3 flex-row items-center gap-2"
          style={{ backgroundColor: `${colors.warning}14` }}
        >
          <Feather name="alert-triangle" size={14} color={colors.warning} />
          <Text className="text-xs flex-1 text-text-primary leading-4">
            {t('vendor.locations.payoutMissing')}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: colors.warning }}>
            {t('vendor.locations.setUpPayments')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: 'primary' | 'success' | 'muted' }) {
  const palette = {
    primary: { bg: colors.primary[50], fg: colors.primary.DEFAULT },
    success: { bg: `${colors.success}14`, fg: colors.success },
    muted: { bg: colors.background, fg: colors.text.secondary },
  }[tone];

  return (
    <View
      className="rounded-full px-2 py-0.5"
      style={{ backgroundColor: palette.bg }}
    >
      <Text className="text-[10px] font-bold" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View className="items-center px-10 py-12">
      <Feather name="map-pin" size={48} color={colors.primary[200]} />
      <Text className="text-base font-semibold text-text-primary text-center mt-4">
        {t('vendor.locations.emptyTitle')}
      </Text>
      <Text className="text-sm text-text-secondary text-center mt-1 leading-5">
        {t('vendor.locations.emptyDesc')}
      </Text>
    </View>
  );
}

// ── Action sheet ──────────────────────────────────────────────────────────────

interface LocationActionSheetProps {
  location: ChainLocation | null;
  canEdit: boolean;
  canRemove: boolean;
  onClose: () => void;
  onEdit: () => void;
  onWorkers: () => void;
  onPayments: () => void;
  onRemove: () => void;
}

function LocationActionSheet({
  location,
  canEdit,
  canRemove,
  onClose,
  onEdit,
  onWorkers,
  onPayments,
  onRemove,
}: LocationActionSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={location != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-surface rounded-t-2xl" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="px-5 pt-5 pb-3 border-b border-border">
            <Text className="text-base font-bold text-text-primary">
              {location?.locationName}
            </Text>
          </View>

          {canEdit && (
            <SheetRow
              icon="edit-2"
              label={
                location?.isHeadquarters
                  ? t('vendor.locations.actionEditHq')
                  : t('vendor.locations.actionEdit')
              }
              onPress={onEdit}
            />
          )}
          <SheetRow icon="users" label={t('vendor.locations.actionWorkers')} onPress={onWorkers} />
          <SheetRow
            icon="credit-card"
            label={t('vendor.locations.actionPayments')}
            onPress={onPayments}
          />
          {canRemove && (
            <SheetRow
              icon="trash-2"
              label={t('vendor.locations.actionRemove')}
              onPress={onRemove}
              destructive
            />
          )}

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            className="items-center py-4 mt-1"
          >
            <Text className="text-[15px] font-semibold text-text-secondary">
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-3.5 px-5 py-3.5"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Feather
        name={icon}
        size={20}
        color={destructive ? colors.error : colors.text.secondary}
      />
      <Text
        className="text-[15px] flex-1"
        style={{ color: destructive ? colors.error : colors.text.primary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
