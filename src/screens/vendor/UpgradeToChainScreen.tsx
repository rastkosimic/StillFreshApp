import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import { useVendorIdentity } from '@/hooks/useVendorIdentity';
import { VendorStackScreenProps } from '@/navigation/types';
import { upgradeToChain } from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { handleInactiveAccount, mapChainError } from '@/utils/chainErrors';

type Props = VendorStackScreenProps<'VendorUpgradeToChain'>;
type FeatherName = React.ComponentProps<typeof Feather>['name'];

const CHAIN_NAME_MIN = 2;
const CHAIN_NAME_MAX = 100;

export default function UpgradeToChainScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { identity, isLoading, refresh } = useVendorIdentity();

  const [chainName, setChainName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = chainName.trim();
  const isNameValid = trimmed.length >= CHAIN_NAME_MIN && trimmed.length <= CHAIN_NAME_MAX;

  // The backend enforces all three of these; checking them here keeps the user out of a
  // form whose submit can only ever fail.
  const blocker = !isLoading ? resolveBlocker(identity) : null;
  const canSubmit = blocker == null && isNameValid && !isSubmitting;

  const onConfirm = () => {
    Alert.alert(
      t('vendor.upgradeToChainScreen.confirmTitle'),
      t('vendor.upgradeToChainScreen.confirmMsg', { chainName: trimmed }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('vendor.upgradeToChainScreen.confirmCta'), onPress: () => void submit() },
      ],
    );
  };

  const submit = async () => {
    setFieldError(null);
    setIsSubmitting(true);
    try {
      await upgradeToChain(trimmed);
      // Read chainId and isHeadquarters back from the server rather than assuming them.
      await refresh();
      Alert.alert(
        t('vendor.upgradeToChainScreen.successTitle'),
        t('vendor.upgradeToChainScreen.successMsg', { chainName: trimmed }),
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.replace('VendorChainLocationManagement'),
          },
        ],
      );
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      const mapped = mapChainError(error);

      if (mapped.field === 'chainName') {
        setFieldError(t(mapped.key, { defaultValue: mapped.raw }));
      } else if (mapped.action === 'refreshProfile') {
        await refresh();
        Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }), [
          {
            text: t('common.ok'),
            onPress: () => navigation.replace('VendorChainLocationManagement'),
          },
        ]);
      } else {
        Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        className="bg-background border-b border-border px-5 pb-3.5 flex-row items-center gap-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="flex-1 text-[17px] font-semibold text-primary">
          {t('vendor.upgradeToChainScreen.title')}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-2xl font-bold text-text-primary mb-2">
            {t('vendor.upgradeToChainScreen.heading')}
          </Text>
          <Text className="text-sm text-text-secondary leading-5 mb-5">
            {t('vendor.upgradeToChainScreen.intro')}
          </Text>

          {blocker ? (
            <BlockerCard
              blocker={blocker}
              onPrimary={() => {
                if (blocker === 'alreadyChain') {
                  navigation.replace('VendorChainLocationManagement');
                  return;
                }
                // RootNavigator only mounts OnboardingStack when profileCompleted is false,
                // so a nested navigate from VendorStack cannot reach it. Send the vendor back
                // to the dashboard; they need a session that re-enters onboarding.
                navigation.goBack();
              }}
            />
          ) : (
            <>
              <View className="bg-surface rounded-2xl border border-border p-4 mb-5">
                <Text className="text-base font-bold text-text-primary mb-3">
                  {t('vendor.upgradeToChainScreen.changesTitle')}
                </Text>
                <ChangeRow
                  icon="home"
                  title={t('vendor.upgradeToChainScreen.changeHqTitle')}
                  description={t('vendor.upgradeToChainScreen.changeHqDesc', {
                    locationName: identity.locationName ?? identity.profile?.username ?? '',
                  })}
                />
                <ChangeRow
                  icon="credit-card"
                  title={t('vendor.upgradeToChainScreen.changeBankingTitle')}
                  description={t('vendor.upgradeToChainScreen.changeBankingDesc')}
                />
                <ChangeRow
                  icon="tag"
                  title={t('vendor.upgradeToChainScreen.changeOffersTitle')}
                  description={t('vendor.upgradeToChainScreen.changeOffersDesc')}
                  isLast
                />
              </View>

              <Text className="text-text-primary text-sm font-medium mb-1">
                {t('vendor.chainName')} *
              </Text>
              <TextInput
                className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
                style={{
                  borderColor: fieldError
                    ? colors.error
                    : trimmed.length > 0
                      ? colors.primary.DEFAULT
                      : colors.border,
                }}
                value={chainName}
                onChangeText={(value) => {
                  setChainName(value);
                  if (fieldError) setFieldError(null);
                }}
                placeholder={t('vendor.upgradeToChainScreen.chainNamePlaceholder')}
                placeholderTextColor={colors.text.secondary}
                maxLength={CHAIN_NAME_MAX}
                autoCapitalize="words"
                editable={!isSubmitting}
              />
              {fieldError ? (
                <Text className="text-error text-xs mt-1">{fieldError}</Text>
              ) : (
                <Text className="text-xs text-text-secondary mt-1">
                  {t('vendor.upgradeToChainScreen.chainNameHint')}
                </Text>
              )}

              <View
                className="rounded-xl px-4 py-3 mt-5 flex-row gap-2.5"
                style={{ backgroundColor: `${colors.warning}14` }}
              >
                <Feather name="alert-triangle" size={16} color={colors.warning} />
                <Text className="text-xs leading-4 flex-1 text-text-primary">
                  {t('vendor.upgradeToChainScreen.irreversible')}
                </Text>
              </View>

              <TouchableOpacity
                className="rounded-xl py-4 items-center mt-6"
                style={{ backgroundColor: canSubmit ? colors.primary.DEFAULT : colors.border }}
                onPress={onConfirm}
                disabled={!canSubmit}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className="font-semibold text-base"
                    style={{ color: canSubmit ? '#fff' : colors.text.secondary }}
                  >
                    {t('vendor.upgradeToChainScreen.submit')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Preconditions ─────────────────────────────────────────────────────────────

type Blocker = 'notAdmin' | 'alreadyChain' | 'onboarding';

function resolveBlocker(identity: {
  isAdmin: boolean;
  isChainLocation: boolean;
  onboardingStatus: string | null;
}): Blocker | null {
  if (!identity.isAdmin) return 'notAdmin';
  if (identity.isChainLocation) return 'alreadyChain';
  // The chain flow expects a headquarters step that is unreachable once the type is UNIQUE,
  // so onboarding has to be finished before the upgrade is allowed.
  if (identity.onboardingStatus !== 'COMPLETED') return 'onboarding';
  return null;
}

function BlockerCard({ blocker, onPrimary }: { blocker: Blocker; onPrimary: () => void }) {
  const { t } = useTranslation();

  const icons: Record<Blocker, FeatherName> = {
    notAdmin: 'lock',
    alreadyChain: 'git-merge',
    onboarding: 'clock',
  };

  return (
    <View className="bg-surface rounded-2xl border border-border p-6 items-center">
      <View
        className="w-14 h-14 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: colors.primary[50] }}
      >
        <Feather name={icons[blocker]} size={24} color={colors.primary.DEFAULT} />
      </View>
      <Text className="text-base font-semibold text-text-primary text-center mb-2">
        {t(`vendor.upgradeToChainScreen.blocked.${blocker}Title`)}
      </Text>
      <Text className="text-sm text-text-secondary text-center leading-5 mb-5">
        {t(`vendor.upgradeToChainScreen.blocked.${blocker}Desc`)}
      </Text>
      <TouchableOpacity
        className="bg-primary rounded-xl py-3.5 px-6 items-center self-stretch"
        activeOpacity={0.8}
        onPress={onPrimary}
      >
        <Text className="text-white font-semibold text-base">
          {t(`vendor.upgradeToChainScreen.blocked.${blocker}Cta`)}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ChangeRow({
  icon,
  title,
  description,
  isLast,
}: {
  icon: FeatherName;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <View className={`flex-row gap-3 ${isLast ? '' : 'mb-4'}`}>
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: colors.primary[50] }}
      >
        <Feather name={icon} size={16} color={colors.primary.DEFAULT} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary">{title}</Text>
        <Text className="text-xs text-text-secondary leading-4 mt-0.5">{description}</Text>
      </View>
    </View>
  );
}
