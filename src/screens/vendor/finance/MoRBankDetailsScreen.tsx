import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import HolderNameLinesInput from '@/components/HolderNameLinesInput';
import { VendorStackScreenProps } from '@/navigation/types';
import {
  getLocationMoRBankDetails,
  getMoRBankDetails,
  getPaymentStatus,
  saveLocationMoRBankDetails,
  saveMoRBankDetails,
} from '@/services/vendorPaymentService';
import { colors } from '@/theme/colors';
import { MoRBankDetails, MoRBankDetailsResponse, PaymentStatus } from '@/types';
import { handleInactiveAccount, mapChainError } from '@/utils/chainErrors';
import {
  ACCOUNT_NUMBER_INPUT_MAX_LENGTH,
  EMPTY_HOLDER_NAME_LINES,
  formatAccountNumberInput,
  holderNameLineError,
  isCompleteAccountInput,
  joinHolderNameLines,
  splitHolderName,
  validateAccountNumber,
  type HolderNameLines,
} from '@/utils/formatBankDetails';

type Props = VendorStackScreenProps<'VendorMoRBankDetails'>;

type FieldKey = 'holderName' | 'accountNumber';

// accountNumber always starts blank — the user must re-enter it;
// the backend never returns the raw value, only a masked one.
interface EditForm {
  holderLines: HolderNameLines;
  accountNumber: string;
}

type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY_FORM: EditForm = {
  holderLines: EMPTY_HOLDER_NAME_LINES,
  accountNumber: '',
};

function buildEditForm(d: MoRBankDetailsResponse): EditForm {
  return {
    holderLines: splitHolderName(d.holderName ?? '').lines,
    accountNumber: '',
  };
}

export default function MoRBankDetailsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const locationId = route.params?.locationId;
  const locationName = route.params?.locationName;
  const isLocationScoped = locationId != null;

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [details, setDetails] = useState<MoRBankDetailsResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [holderOverflow, setHolderOverflow] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;
  const scrollRef = useRef<ScrollView>(null);
  const fieldsBlockY = useRef(0);
  const rowOffsets = useRef<Partial<Record<FieldKey, number>>>({});
  const focusedField = useRef<FieldKey | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollFieldIntoView = useCallback((key: FieldKey) => {
    const rowY = rowOffsets.current[key];
    if (rowY == null) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, fieldsBlockY.current + rowY - 12),
      animated: true,
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      const key = focusedField.current;
      if (key) {
        setTimeout(() => scrollFieldIntoView(key), 80);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollFieldIntoView]);

  const onFieldFocus = (key: FieldKey) => {
    focusedField.current = key;
    setTimeout(() => scrollFieldIntoView(key), keyboardHeight > 0 ? 50 : 280);
  };

  const clearFieldError = (key: FieldKey) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const setFieldError = (key: FieldKey, message: string) =>
    setFieldErrors((prev) => ({ ...prev, [key]: message }));

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent && !isEditingRef.current) setIsLoading(true);
      try {
        if (isLocationScoped && locationId != null) {
          // Location-scoped: payment/status describes the signed-in account, not the target.
          // Readiness for this screen is driven by hasBankDetails on the location response.
          const d = await getLocationMoRBankDetails(locationId);
          setPaymentStatus(null);
          setDetails(d);
          if (isEditingRef.current) return;
          if (d.hasBankDetails) {
            setIsEditing(false);
          } else {
            setForm(EMPTY_FORM);
            setHolderOverflow(false);
            setFieldErrors({});
            setIsEditing(true);
          }
          return;
        }

        const [statusResult, detailsResult] = await Promise.allSettled([
          getPaymentStatus(),
          getMoRBankDetails(),
        ]);

        if (statusResult.status === 'fulfilled') {
          setPaymentStatus(statusResult.value);
        }

        if (detailsResult.status === 'fulfilled') {
          const d = detailsResult.value;
          setDetails(d);
          if (isEditingRef.current) return;
          if (d.hasBankDetails) {
            setIsEditing(false);
          } else {
            setForm(EMPTY_FORM);
            setHolderOverflow(false);
            setFieldErrors({});
            setIsEditing(true);
          }
        } else if (!isEditingRef.current) {
          setDetails(null);
          setForm(EMPTY_FORM);
          setHolderOverflow(false);
          setFieldErrors({});
          setIsEditing(true);
        }
      } catch (error) {
        if (await handleInactiveAccount(error)) return;
        if (isEditingRef.current) return;
        const mapped = mapChainError(error);
        setDetails(null);
        setForm(EMPTY_FORM);
        setHolderOverflow(false);
        setFieldErrors({});
        setIsEditing(true);
        Alert.alert(t('common.error'), t(mapped.key, { defaultValue: mapped.raw }));
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [isLocationScoped, locationId, t],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData(true);
    setIsRefreshing(false);
  }, [loadData]);

  const parsedAccount = validateAccountNumber(form.accountNumber);
  const isValid =
    holderNameLineError(form.holderLines) === null && !holderOverflow && parsedAccount.ok;

  const canSave = isValid && !isSubmitting;

  const enterEditMode = () => {
    setForm(details?.hasBankDetails ? buildEditForm(details) : EMPTY_FORM);
    setHolderOverflow(false);
    setFieldErrors({});
    setIsEditing(true);
  };

  const onCancelEdit = () => {
    setFieldErrors({});
    if (details?.hasBankDetails) {
      setIsEditing(false);
    } else {
      navigation.goBack();
    }
  };

  const buildPayload = (): MoRBankDetails | null => {
    const account = validateAccountNumber(form.accountNumber);
    if (!account.ok) return null;
    return {
      holderName: joinHolderNameLines(form.holderLines),
      accountNumber: account.accountNumber,
      payoutMethod: 'BANK',
    };
  };

  const onAccountNumberChange = (value: string) => {
    const formatted = formatAccountNumberInput(value);
    setForm((prev) => ({ ...prev, accountNumber: formatted }));
    const parsed = validateAccountNumber(formatted);
    if (parsed.ok || !isCompleteAccountInput(formatted)) {
      clearFieldError('accountNumber');
      return;
    }
    setFieldError(
      'accountNumber',
      parsed.reason === 'checksum'
        ? t('payment.accountNumberChecksumInvalid')
        : t('payment.accountNumberInvalid'),
    );
  };

  const validateHolderName = (lines: HolderNameLines = form.holderLines): boolean => {
    if (holderOverflow) {
      setFieldError('holderName', t('payment.holderNameTooLong'));
      return false;
    }
    const reason = holderNameLineError(lines);
    if (reason === null) {
      clearFieldError('holderName');
      return true;
    }
    setFieldError(
      'holderName',
      reason === 'gap' ? t('payment.holderNameGap') : t('payment.fieldRequired'),
    );
    return false;
  };

  const validateAccountField = (value: string = form.accountNumber): boolean => {
    const result = validateAccountNumber(value);
    if (result.ok) {
      clearFieldError('accountNumber');
      return true;
    }
    setFieldError(
      'accountNumber',
      result.reason === 'empty'
        ? t('payment.fieldRequired')
        : result.reason === 'checksum'
          ? t('payment.accountNumberChecksumInvalid')
          : t('payment.accountNumberInvalid'),
    );
    return false;
  };

  const validateAllFields = (): boolean => {
    const holderOk = validateHolderName();
    const accountOk = validateAccountField();
    return holderOk && accountOk;
  };

  const persist = async (): Promise<boolean> => {
    const payload = buildPayload();
    if (!payload) return false;
    if (isLocationScoped && locationId != null) {
      await saveLocationMoRBankDetails(locationId, payload);
    } else {
      await saveMoRBankDetails(payload);
    }
    return true;
  };

  const applyServerFieldError = (mapped: ReturnType<typeof mapChainError>) => {
    const message = t(mapped.key, { defaultValue: mapped.raw });
    if (mapped.field === 'accountNumber' || /account/i.test(mapped.raw)) {
      setFieldError('accountNumber', message);
    } else if (mapped.field === 'holderName') {
      setFieldError('holderName', message);
    }
  };

  const onSave = () => {
    if (isSubmitting) return;
    if (!validateAllFields()) {
      return;
    }

    const isUpdate = details?.hasBankDetails === true;
    const run = async () => {
      setIsSubmitting(true);
      try {
        const saved = await persist();
        if (!saved) return;
        Alert.alert(t('common.success'), t('payment.morSaveSuccess'), [
          {
            text: t('common.ok'),
            onPress: () => {
              navigation.navigate('VendorTabs', { screen: 'VendorDashboard' });
            },
          },
        ]);
      } catch (error) {
        if (await handleInactiveAccount(error)) return;
        const mapped = mapChainError(error);
        const message = t(mapped.key, { defaultValue: mapped.raw });
        applyServerFieldError(mapped);
        Alert.alert(t('common.error'), message || t('errors.serverError'));
      } finally {
        setIsSubmitting(false);
      }
    };

    if (isUpdate) {
      Alert.alert(t('payment.morChangeConfirmTitle'), t('payment.morChangeConfirmMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.save'), onPress: () => void run() },
      ]);
      return;
    }
    void run();
  };

  const isReady = isLocationScoped
    ? details?.hasBankDetails === true
    : paymentStatus?.isReady === true;
  const isPending = isLocationScoped
    ? false
    : paymentStatus?.hasAccount === true && !isReady;
  const statusLabel = isReady
    ? t('payment.statusReady')
    : isPending
      ? t('payment.statusPending')
      : t('payment.statusNotSetup');
  const statusColor = isReady
    ? colors.success
    : isPending
      ? colors.warning
      : colors.text.secondary;

  const accountHint = t('payment.accountNumberHint');

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="bg-background border-b border-border px-5 pb-3.5 flex-row items-center gap-2.5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <BackButton onPress={isEditing ? onCancelEdit : () => navigation.goBack()} />

        <View className="flex-1">
          <Text className="text-[17px] font-semibold text-primary text-center">
            {t('payment.morBankDetails')}
          </Text>
          {isLocationScoped && locationName ? (
            <Text className="text-xs text-text-secondary text-center mt-0.5">
              {locationName}
            </Text>
          ) : null}
        </View>

        {isEditing ? (
          // Spacer keeps the title centered (mirrors BackButton width)
          <View className="w-9 h-9" />
        ) : (
          <TouchableOpacity
            onPress={enterEditMode}
            activeOpacity={0.7}
            hitSlop={8}
            className="w-9 h-9 rounded-full bg-background items-center justify-center"
          >
            <Feather name="edit-2" size={16} color={colors.primary.DEFAULT} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 32 + (keyboardHeight > 0 ? keyboardHeight : 0),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          !isEditing ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.DEFAULT}
            />
          ) : undefined
        }
      >
        <View className="mx-4 mt-5 bg-surface rounded-[14px] p-3.5 border border-border">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-text-secondary">{t('payment.modelMor')}</Text>
            <View
              className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${statusColor}18` }}
            >
              <View
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text className="text-[13px] text-text-secondary mt-2 leading-[18px]">
            {isReady
              ? t('payment.statusMessageReady')
              : isPending
                ? t('payment.statusMessagePending')
                : isLocationScoped
                  ? t('payment.locationMorNotSetup')
                  : t('payment.statusMessageNotSetup')}
          </Text>
        </View>

        {!isEditing && details?.hasBankDetails && (
          <View className="mt-4 bg-surface border-y border-border">
            {(
              [
                { label: t('payment.holderName'), value: details.holderName },
                { label: t('payment.accountNumber'), value: details.accountNumberMasked },
              ] as { label: string; value: string | undefined }[]
            )
              .filter((row) => row.value)
              .map((row, idx, arr) => (
                <View
                  key={row.label}
                  className="px-4 py-3"
                  style={{
                    borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1">
                    {row.label}
                  </Text>
                  <Text className="text-[15px] text-text-primary">{row.value}</Text>
                </View>
              ))}
          </View>
        )}

        {isEditing && (
          <>
            {details?.hasBankDetails && (
              <View
                className="mx-4 mt-4 rounded-[10px] px-3.5 py-2.5 flex-row items-start gap-2 border"
                style={{
                  backgroundColor: `${colors.warning}14`,
                  borderColor: colors.warning,
                }}
              >
                <Feather name="info" size={14} color={colors.warning} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-[13px] leading-[18px] text-text-primary">
                  {t('payment.morReentryHint')}
                </Text>
              </View>
            )}

            <View
              className="mt-4 bg-surface border-y border-border"
              onLayout={(event) => {
                fieldsBlockY.current = event.nativeEvent.layout.y;
              }}
            >
              <View
                className="px-4 py-2.5 border-b border-border"
                onLayout={(event) => {
                  rowOffsets.current.holderName = event.nativeEvent.layout.y;
                }}
              >
                <HolderNameLinesInput
                  lines={form.holderLines}
                  error={fieldErrors.holderName}
                  onFocus={() => onFieldFocus('holderName')}
                  onChange={(lines, overflow) => {
                    setForm((prev) => ({ ...prev, holderLines: lines }));
                    setHolderOverflow(overflow);
                    if (overflow) {
                      setFieldError('holderName', t('payment.holderNameTooLong'));
                      return;
                    }
                    if (holderNameLineError(lines) === 'gap') {
                      setFieldError('holderName', t('payment.holderNameGap'));
                      return;
                    }
                    clearFieldError('holderName');
                  }}
                />
              </View>
              <FieldRow
                label={`${t('payment.accountNumber')} *`}
                isLast
                error={fieldErrors.accountNumber}
                hint={fieldErrors.accountNumber ? undefined : accountHint}
                onLayout={(event) => {
                  rowOffsets.current.accountNumber = event.nativeEvent.layout.y;
                }}
              >
                <BankFieldInput
                  value={form.accountNumber}
                  onChangeText={onAccountNumberChange}
                  onFocus={() => onFieldFocus('accountNumber')}
                  onBlur={() => validateAccountField()}
                  placeholder="160-0000000380290-23"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={ACCOUNT_NUMBER_INPUT_MAX_LENGTH}
                  returnKeyType="done"
                  onSubmitEditing={canSave ? onSave : undefined}
                />
              </FieldRow>
            </View>
          </>
        )}

        <View className="flex-row gap-2 mx-4 mt-6 items-start">
          <Feather name="shield" size={14} color={colors.text.secondary} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-xs text-text-secondary leading-4">
            {isLocationScoped
              ? t('payment.locationMorSecurityNote')
              : t('vendor.onboarding.paymentSecurityNote')}
          </Text>
        </View>

        {isEditing ? (
          <View className="mx-4 mt-6">
            <TouchableOpacity
              onPress={onSave}
              disabled={!canSave}
              className="rounded-xl py-4 items-center mb-3"
              style={{ backgroundColor: canSave ? colors.primary.DEFAULT : colors.border }}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text
                  className="font-semibold text-base"
                  style={{ color: canSave ? colors.text.inverse : colors.text.secondary }}
                >
                  {t('common.save')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCancelEdit}
              className="py-3 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-text-secondary font-semibold text-base">
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BankFieldInput(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.text.secondary}
      style={[
        {
          color: colors.text.primary,
          fontSize: 15,
          lineHeight: 20,
          minHeight: 22,
          paddingVertical: 0,
          paddingHorizontal: 0,
          width: '100%',
        },
        props.style,
      ]}
    />
  );
}

function FieldRow({
  label,
  children,
  isLast,
  error,
  hint,
  onLayout,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  error?: string;
  hint?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const hasError = Boolean(error);

  return (
    <View
      className="px-4 py-2.5"
      onLayout={onLayout}
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: hasError ? `${colors.error}08` : undefined,
      }}
    >
      <Text
        className="text-[11px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: hasError ? colors.error : colors.text.secondary }}
      >
        {label}
      </Text>
      <View
        className="rounded-lg px-2.5 py-2 border"
        style={{
          borderColor: hasError ? colors.error : colors.border,
          backgroundColor: colors.background,
        }}
      >
        {children}
      </View>
      {error ? (
        <Text className="mt-1.5 text-xs leading-4" style={{ color: colors.error }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-1.5 text-xs leading-4 text-text-secondary">{hint}</Text>
      ) : null}
    </View>
  );
}
