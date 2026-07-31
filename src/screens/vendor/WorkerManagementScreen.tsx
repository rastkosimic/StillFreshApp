import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import OneTimeCredentialsModal from '@/components/OneTimeCredentialsModal';
import WorkerFormModal, { WorkerFormResult } from '@/components/WorkerFormModal';
import { useVendorIdentity } from '@/hooks/useVendorIdentity';
import { VendorStackScreenProps } from '@/navigation/types';
import {
  activateWorker,
  createWorker,
  deactivateWorker,
  deleteWorker,
  getChainLocations,
  getLocationWorkers,
  updateWorker,
} from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { ChainLocation, Worker } from '@/types';
import { handleInactiveAccount, mapChainError } from '@/utils/chainErrors';

type Props = VendorStackScreenProps<'VendorWorkerManagement'>;

const WORKERS_PER_LOCATION_CAP = 100;

export default function WorkerManagementScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { identity, isLoading: isIdentityLoading } = useVendorIdentity();

  const [locations, setLocations] = useState<ChainLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    route.params?.locationId ?? null,
  );
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAtWorkerCap, setIsAtWorkerCap] = useState(false);
  const [busyWorkerId, setBusyWorkerId] = useState<number | null>(null);

  const [editorWorker, setEditorWorker] = useState<Worker | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createdPassword, setCreatedPassword] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [menuWorker, setMenuWorker] = useState<Worker | null>(null);

  const isHeadquarters = identity.isHeadquarters;
  const isChain = identity.isChainLocation;

  // Branch admins and standalone vendors can only ever manage their own location, so the
  // selector is pointless there and the id is fixed to the signed-in account.
  const canChooseLocation = isHeadquarters && isChain;

  const loadLocations = useCallback(async () => {
    if (identity.vendorId == null) return;
    if (!isChain) {
      // A standalone vendor's only valid location id is its own.
      setLocations([]);
      setSelectedLocationId((current) => current ?? identity.vendorId);
      return;
    }
    try {
      const rows = await getChainLocations();
      setLocations(rows);
      setSelectedLocationId((current) => {
        if (current != null && rows.some((r) => r.id === current)) return current;
        if (!isHeadquarters) return identity.vendorId;
        return rows.find((r) => r.isHeadquarters)?.id ?? rows[0]?.id ?? identity.vendorId;
      });
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      setLocations([]);
    }
  }, [identity.vendorId, isChain, isHeadquarters]);

  useEffect(() => {
    if (isIdentityLoading) return;
    void loadLocations();
  }, [isIdentityLoading, loadLocations]);

  const loadWorkers = useCallback(
    async (silent = false) => {
      if (selectedLocationId == null) return;
      if (!silent) setIsLoading(true);
      try {
        const rows = await getLocationWorkers(selectedLocationId);
        setWorkers(rows);
        setIsAtWorkerCap(rows.length >= WORKERS_PER_LOCATION_CAP);
      } catch (error) {
        if (await handleInactiveAccount(error)) return;
        setWorkers([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [selectedLocationId],
  );

  useEffect(() => {
    if (selectedLocationId == null) {
      if (!isIdentityLoading) setIsLoading(false);
      return;
    }
    void loadWorkers();
  }, [selectedLocationId, isIdentityLoading, loadWorkers]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadLocations(), loadWorkers(true)]);
    setIsRefreshing(false);
  }, [loadLocations, loadWorkers]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const locationLabel =
    selectedLocation?.locationName ??
    route.params?.locationName ??
    identity.locationName ??
    '';

  const isSelectedPayoutReady =
    selectedLocation == null
      ? identity.onboardingStatus === 'COMPLETED'
      : selectedLocation.onboardingStatus === 'COMPLETED';

  // Reassignment targets are real locations only — a worker row here would be rejected.
  const reassignTargets = isHeadquarters
    ? locations.filter((l) => l.status !== 'INACTIVE')
    : [];

  const activeCount = workers.filter((w) => w.status === 'ACTIVE').length;

  // ── Mutations ───────────────────────────────────────────────────────────────

  const onSubmitForm = async (result: WorkerFormResult) => {
    if (selectedLocationId == null) return;
    setIsSaving(true);
    setFormErrors({});
    try {
      if (result.create) {
        await createWorker(selectedLocationId, result.create);
        const { username, password } = result.create;
        setIsEditorOpen(false);
        // Not returned by the API and not recoverable — show it once so the admin can pass
        // it on if the credentials email never lands.
        setCreatedPassword({ username, password });
      } else if (result.update && editorWorker) {
        await updateWorker(editorWorker.id, result.update);
        setIsEditorOpen(false);
      }
      await loadWorkers(true);
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      const mapped = mapChainError(error);
      const message = t(mapped.key, { defaultValue: mapped.raw });
      if (mapped.field) {
        setFormErrors({ [mapped.field]: message });
      } else {
        if (mapped.action === 'refetchLocations') await loadLocations();
        if (mapped.action === 'contactSupport') setIsAtWorkerCap(true);
        Alert.alert(t('common.error'), message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const onToggleStatus = (worker: Worker) => {
    setMenuWorker(null);
    const isActive = worker.status === 'ACTIVE';
    Alert.alert(
      isActive
        ? t('vendor.workers.deactivateTitle', { username: worker.username })
        : t('vendor.workers.activateTitle', { username: worker.username }),
      isActive ? t('vendor.workers.deactivateMsg') : t('vendor.workers.activateMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isActive
            ? t('vendor.workers.deactivate')
            : t('vendor.workers.activate'),
          onPress: () => void runStatusChange(worker, isActive),
        },
      ],
    );
  };

  const runStatusChange = async (worker: Worker, isActive: boolean) => {
    setBusyWorkerId(worker.id);
    try {
      await (isActive ? deactivateWorker(worker.id) : activateWorker(worker.id));
      await loadWorkers(true);
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      const mapped = mapChainError(error);
      Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }));
    } finally {
      setBusyWorkerId(null);
    }
  };

  const onDelete = (worker: Worker) => {
    setMenuWorker(null);
    Alert.alert(
      t('vendor.workers.deleteTitle', { username: worker.username }),
      t('vendor.workers.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendor.workers.deactivateInstead'),
          onPress: () => void runStatusChange(worker, true),
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => void runDelete(worker),
        },
      ],
    );
  };

  const runDelete = async (worker: Worker) => {
    setBusyWorkerId(worker.id);
    try {
      await deleteWorker(worker.id);
      await loadWorkers(true);
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      const mapped = mapChainError(error);
      Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }));
    } finally {
      setBusyWorkerId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isIdentityLoading && !identity.isAdmin) {
    return (
      <View className="flex-1 bg-background">
        <Header
          insets={insets}
          title={t('vendor.workers.title')}
          subtitle={null}
          onBack={() => navigation.goBack()}
        />
        <View className="flex-1 items-center justify-center px-10">
          <Feather name="lock" size={44} color={colors.primary[200]} />
          <Text className="text-base font-semibold text-text-primary text-center mt-4">
            {t('vendor.workers.noAccessTitle')}
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-1 leading-5">
            {t('vendor.workers.noAccessDesc')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Header
        insets={insets}
        title={t('vendor.workers.title')}
        subtitle={locationLabel || null}
        onBack={() => navigation.goBack()}
      />

      {isLoading || isIdentityLoading ? (
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
          {canChooseLocation && locations.length > 1 && (
            <View className="mt-4">
              <Text className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-1.5 mx-5">
                {t('vendor.workers.locationSelector')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
              >
                {locations.map((loc) => {
                  const isSelected = loc.id === selectedLocationId;
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      onPress={() => setSelectedLocationId(loc.id)}
                      activeOpacity={0.8}
                      className="rounded-full px-4 py-1.5 border"
                      style={{
                        backgroundColor: isSelected ? colors.primary.DEFAULT : colors.surface,
                        borderColor: isSelected ? colors.primary.DEFAULT : colors.border,
                      }}
                    >
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: isSelected ? '#fff' : colors.text.primary }}
                      >
                        {loc.locationName}
                        {loc.isHeadquarters ? ` · ${t('vendor.profile.headquarters')}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View className="flex-row items-baseline justify-between mx-5 mt-5 mb-1.5">
            <Text className="text-xs text-text-secondary font-semibold uppercase tracking-wide">
              {t('vendor.workers.listLabel')}
            </Text>
            <Text className="text-xs text-text-secondary">
              {t('vendor.workers.capCounter', {
                count: workers.length,
                cap: WORKERS_PER_LOCATION_CAP,
              })}
            </Text>
          </View>

          {!isSelectedPayoutReady && (
            <View
              className="mx-4 mb-3 rounded-xl px-4 py-3 flex-row gap-2.5"
              style={{ backgroundColor: `${colors.warning}14` }}
            >
              <Feather name="alert-triangle" size={16} color={colors.warning} />
              <Text className="text-xs leading-4 flex-1 text-text-primary">
                {t('vendor.workers.locationNotReadyWarning')}
              </Text>
            </View>
          )}

          {workers.length === 0 ? (
            <View className="items-center px-10 py-12">
              <Feather name="users" size={48} color={colors.primary[200]} />
              <Text className="text-base font-semibold text-text-primary text-center mt-4">
                {t('vendor.workers.emptyTitle')}
              </Text>
              <Text className="text-sm text-text-secondary text-center mt-1 leading-5">
                {t('vendor.workers.emptyDesc')}
              </Text>
            </View>
          ) : (
            <View className="px-4 gap-2.5">
              {workers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  isBusy={busyWorkerId === worker.id}
                  onOpenMenu={() => setMenuWorker(worker)}
                  onToggleStatus={() => onToggleStatus(worker)}
                />
              ))}
            </View>
          )}

          <View className="px-4 mt-5">
            <TouchableOpacity
              className="rounded-xl py-4 items-center flex-row justify-center gap-2"
              style={{
                backgroundColor:
                  isAtWorkerCap || !isSelectedPayoutReady
                    ? colors.border
                    : colors.primary.DEFAULT,
              }}
              activeOpacity={0.8}
              disabled={isAtWorkerCap || !isSelectedPayoutReady || selectedLocationId == null}
              onPress={() => {
                setEditorWorker(null);
                setFormErrors({});
                setIsEditorOpen(true);
              }}
            >
              <Feather
                name="user-plus"
                size={18}
                color={
                  isAtWorkerCap || !isSelectedPayoutReady
                    ? colors.text.secondary
                    : '#fff'
                }
              />
              <Text
                className="font-semibold text-base"
                style={{
                  color:
                    isAtWorkerCap || !isSelectedPayoutReady
                      ? colors.text.secondary
                      : '#fff',
                }}
              >
                {t('vendor.workers.add')}
              </Text>
            </TouchableOpacity>
            {isAtWorkerCap && (
              <Text className="text-xs text-error text-center mt-2">
                {t('vendor.chainErrors.workerLimit')}
              </Text>
            )}
            {!isAtWorkerCap && !isSelectedPayoutReady && (
              <Text className="text-xs text-text-secondary text-center mt-2">
                {t('vendor.workers.locationNotReadyWarning')}
              </Text>
            )}
            {activeCount !== workers.length && (
              <Text className="text-xs text-text-secondary text-center mt-3">
                {t('vendor.workers.activeSummary', {
                  active: activeCount,
                  total: workers.length,
                })}
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      <WorkerFormModal
        visible={isEditorOpen}
        worker={editorWorker}
        isSaving={isSaving}
        fieldErrors={formErrors}
        reassignTargets={reassignTargets}
        isLocationPayoutReady={isSelectedPayoutReady}
        onClose={() => setIsEditorOpen(false)}
        onSubmit={(result) => void onSubmitForm(result)}
        onFieldChange={(field) =>
          setFormErrors((prev) => {
            if (prev[field] == null) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
          })
        }
      />

      <OneTimeCredentialsModal
        visible={createdPassword != null}
        title={t('vendor.workers.createdTitle')}
        description={t('vendor.workers.createdDesc')}
        username={createdPassword?.username}
        password={createdPassword?.password}
        onDismiss={() => setCreatedPassword(null)}
      />

      <WorkerActionSheet
        worker={menuWorker}
        onClose={() => setMenuWorker(null)}
        onEdit={() => {
          if (!menuWorker) return;
          setEditorWorker(menuWorker);
          setFormErrors({});
          setMenuWorker(null);
          setIsEditorOpen(true);
        }}
        onToggleStatus={() => menuWorker && onToggleStatus(menuWorker)}
        onDelete={() => menuWorker && onDelete(menuWorker)}
      />
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({
  insets,
  title,
  subtitle,
  onBack,
}: {
  insets: { top: number };
  title: string;
  subtitle: string | null;
  onBack: () => void;
}) {
  return (
    <View
      className="bg-surface border-b border-border px-5 pb-3.5 flex-row items-center gap-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <BackButton onPress={onBack} />
      <View className="flex-1">
        <Text className="text-[17px] font-semibold text-text-primary">{title}</Text>
        {subtitle ? (
          <Text className="text-xs text-text-secondary mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function WorkerCard({
  worker,
  isBusy,
  onOpenMenu,
  onToggleStatus,
}: {
  worker: Worker;
  isBusy: boolean;
  onOpenMenu: () => void;
  onToggleStatus: () => void;
}) {
  const { t } = useTranslation();
  const isActive = worker.status === 'ACTIVE';

  return (
    <View
      className="bg-surface rounded-[14px] p-4 flex-row items-center gap-3"
      style={{
        opacity: isActive ? 1 : 0.6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: isActive ? colors.primary[50] : colors.background }}
      >
        <Feather
          name="user"
          size={18}
          color={isActive ? colors.primary.DEFAULT : colors.text.secondary}
        />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-[15px] font-semibold text-text-primary" numberOfLines={1}>
            {worker.username}
          </Text>
          <View
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: isActive ? `${colors.success}14` : colors.background,
            }}
          >
            <Text
              className="text-[10px] font-bold"
              style={{ color: isActive ? colors.success : colors.text.secondary }}
            >
              {t(`vendor.status.${isActive ? 'ACTIVE' : 'INACTIVE'}`)}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
          {worker.email}
        </Text>
        {worker.phone ? (
          <Text className="text-xs text-text-secondary" numberOfLines={1}>
            {worker.phone}
          </Text>
        ) : null}
      </View>

      {isBusy ? (
        <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
      ) : (
        <View className="flex-row items-center gap-3">
          {/* Deactivation is reversible and is the intended off-boarding action, so it
              sits on the row while deletion hides in the overflow menu. */}
          <TouchableOpacity
            onPress={onToggleStatus}
            activeOpacity={0.7}
            hitSlop={6}
            className="rounded-full px-3 py-1.5 border"
            style={{ borderColor: colors.border }}
          >
            <Text className="text-xs font-semibold text-text-primary">
              {isActive ? t('vendor.workers.deactivate') : t('vendor.workers.activate')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenMenu} hitSlop={8} activeOpacity={0.7}>
            <Feather name="more-vertical" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function WorkerActionSheet({
  worker,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  worker: Worker | null;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isActive = worker?.status === 'ACTIVE';

  return (
    <Modal visible={worker != null} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-surface rounded-t-2xl" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="px-5 pt-5 pb-3 border-b border-border">
            <Text className="text-base font-bold text-text-primary">{worker?.username}</Text>
          </View>

          <SheetRow icon="edit-2" label={t('vendor.workers.edit')} onPress={onEdit} />
          <SheetRow
            icon={isActive ? 'user-x' : 'user-check'}
            label={isActive ? t('vendor.workers.deactivate') : t('vendor.workers.activate')}
            onPress={onToggleStatus}
          />
          <SheetRow
            icon="trash-2"
            label={t('vendor.workers.delete')}
            onPress={onDelete}
            destructive
          />

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} className="items-center py-4 mt-1">
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
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-3.5 px-5 py-3.5"
      style={{ borderBottomWidth: 1, borderBottomColor: '#F2F2F7' }}
    >
      <Feather name={icon} size={20} color={destructive ? colors.error : colors.text.secondary} />
      <Text
        className="text-[15px] flex-1"
        style={{ color: destructive ? colors.error : colors.text.primary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
