import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  DEFAULT_IBAN_COUNTRY,
  formatAccountNumberInput,
  formatIbanInput,
  formatSwiftInput,
  getIbanCountryCode,
  getIbanDisplayMaxLength,
  getIbanRawMaxLength,
  IBAN_LENGTH_BY_COUNTRY,
  stripBankFormatting,
  validateAccountNumber,
  validateIban,
  validateSwift,
} from '@/utils/formatBankDetails';

type Props = VendorStackScreenProps<'VendorMoRBankDetails'>;

type FieldKey = 'holderName' | 'bankName' | 'swiftCode' | 'accountNumber' | 'iban';

// Fields the user types into edit mode.
// accountNumber and iban always start blank — the user must re-enter them;
// the backend never returns raw values, only masked ones.
interface EditForm {
  holderName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  iban: string;
}

type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY_FORM: EditForm = {
  holderName: '',
  accountNumber: '',
  bankName: '',
  swiftCode: '',
  iban: '',
};

function buildEditForm(d: MoRBankDetailsResponse): EditForm {
  return {
    holderName: d.holderName ?? '',
    accountNumber: '',
    bankName: d.bankName ?? '',
    swiftCode: d.swiftCode ?? '',
    iban: '',
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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
      if (!silent) setIsLoading(true);
      try {
        if (isLocationScoped && locationId != null) {
          // Location-scoped: payment/status describes the signed-in account, not the target.
          // Readiness for this screen is driven by hasBankDetails on the location response.
          const d = await getLocationMoRBankDetails(locationId);
          setPaymentStatus(null);
          setDetails(d);
          if (d.hasBankDetails) {
            setIsEditing(false);
          } else {
            setForm(EMPTY_FORM);
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
          if (d.hasBankDetails) {
            setIsEditing(false);
          } else {
            setForm(EMPTY_FORM);
            setFieldErrors({});
            setIsEditing(true);
          }
        } else {
          setDetails(null);
          setForm(EMPTY_FORM);
          setFieldErrors({});
          setIsEditing(true);
        }
      } catch (error) {
        if (await handleInactiveAccount(error)) return;
        const mapped = mapChainError(error);
        setDetails(null);
        setForm(EMPTY_FORM);
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

  const set = (key: keyof EditForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearFieldError(key);
  };

  const isValid =
    form.holderName.trim() !== '' &&
    form.accountNumber.trim() !== '' &&
    form.bankName.trim() !== '';

  const canSave = isValid && !isSubmitting;

  const enterEditMode = () => {
    setForm(details?.hasBankDetails ? buildEditForm(details) : EMPTY_FORM);
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

  const buildPayload = (): MoRBankDetails => ({
    holderName: form.holderName.trim(),
    accountNumber: form.accountNumber.trim(),
    bankName: form.bankName.trim(),
    swiftCode: form.swiftCode.trim()
      ? stripBankFormatting(form.swiftCode)
      : undefined,
    iban: form.iban.trim() ? stripBankFormatting(form.iban) : undefined,
    payoutMethod: 'BANK',
  });

  const onAccountNumberChange = (value: string) => {
    setForm((prev) => ({ ...prev, accountNumber: formatAccountNumberInput(value) }));
    clearFieldError('accountNumber');
  };

  const onSwiftChange = (value: string) => {
    setForm((prev) => ({ ...prev, swiftCode: formatSwiftInput(value) }));
    clearFieldError('swiftCode');
  };

  const onIbanChange = (value: string) => {
    setForm((prev) => ({ ...prev, iban: formatIbanInput(value) }));
    clearFieldError('iban');
  };

  const ibanErrorMessage = (reason: 'format' | 'length' | 'checksum', raw: string): string => {
    if (reason === 'length') {
      const country = getIbanCountryCode(raw) ?? DEFAULT_IBAN_COUNTRY;
      const length = IBAN_LENGTH_BY_COUNTRY[country] ?? getIbanRawMaxLength(raw);
      return t('payment.ibanLengthInvalid', { length, country });
    }
    if (reason === 'checksum') return t('payment.ibanChecksumInvalid');
    return t('payment.ibanFormatInvalid');
  };

  const swiftErrorMessage = (reason: 'length' | 'format'): string => {
    if (reason === 'length') return t('payment.swiftLengthInvalid');
    return t('payment.swiftFormatInvalid');
  };

  const validateHolderName = (value: string = form.holderName): boolean => {
    if (value.trim()) {
      clearFieldError('holderName');
      return true;
    }
    setFieldError('holderName', t('payment.fieldRequired'));
    return false;
  };

  const validateBankName = (value: string = form.bankName): boolean => {
    if (value.trim()) {
      clearFieldError('bankName');
      return true;
    }
    setFieldError('bankName', t('payment.fieldRequired'));
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
      result.reason === 'empty' ? t('payment.fieldRequired') : t('payment.accountNumberInvalid'),
    );
    return false;
  };

  /** SWIFT is optional; when present it must be exactly 8 or 11 chars and match BIC format. */
  const validateSwiftField = (value: string = form.swiftCode): boolean => {
    if (!value.trim()) {
      clearFieldError('swiftCode');
      return true;
    }
    const result = validateSwift(value);
    if (result.ok) {
      clearFieldError('swiftCode');
      return true;
    }
    if (result.reason === 'empty') {
      clearFieldError('swiftCode');
      return true;
    }
    setFieldError('swiftCode', swiftErrorMessage(result.reason));
    return false;
  };

  /** IBAN is optional when account number is present. */
  const validateIbanField = (value: string = form.iban): boolean => {
    if (!value.trim()) {
      clearFieldError('iban');
      return true;
    }
    const result = validateIban(value);
    if (result.ok) {
      clearFieldError('iban');
      return true;
    }
    if (result.reason === 'empty') {
      clearFieldError('iban');
      return true;
    }
    setFieldError('iban', ibanErrorMessage(result.reason, value));
    return false;
  };

  const validateAllFields = (): boolean => {
    const holderOk = validateHolderName();
    const bankOk = validateBankName();
    const accountOk = validateAccountField();
    const swiftOk = validateSwiftField();
    const ibanOk = validateIbanField();
    return holderOk && bankOk && accountOk && swiftOk && ibanOk;
  };

  const persist = async () => {
    const payload = buildPayload();
    if (isLocationScoped && locationId != null) {
      await saveLocationMoRBankDetails(locationId, payload);
    } else {
      await saveMoRBankDetails(payload);
    }
  };

  const applyServerFieldError = (mapped: ReturnType<typeof mapChainError>) => {
    const message = t(mapped.key, { defaultValue: mapped.raw });
    if (mapped.field === 'iban') setFieldError('iban', message);
    else if (mapped.field === 'swift') setFieldError('swiftCode', message);
    else if (mapped.field === 'accountNumber') setFieldError('accountNumber', message);
    else if (mapped.field === 'holderName') setFieldError('holderName', message);
    else if (mapped.field === 'bankName') setFieldError('bankName', message);
    else if (/swift|bic/i.test(mapped.raw)) setFieldError('swiftCode', message);
    else if (/iban/i.test(mapped.raw)) setFieldError('iban', message);
    else if (/account/i.test(mapped.raw)) setFieldError('accountNumber', message);
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
        await persist();
        Alert.alert(t('common.success'), t('payment.morSaveSuccess'), [
          {
            text: t('common.ok'),
            onPress: () => {
              if (isLocationScoped) {
                navigation.goBack();
              } else {
                void loadData(true);
              }
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

  const ibanMaxLength = getIbanDisplayMaxLength(form.iban);
  const expectedIbanLength =
    IBAN_LENGTH_BY_COUNTRY[getIbanCountryCode(form.iban) ?? DEFAULT_IBAN_COUNTRY] ??
    getIbanRawMaxLength(form.iban);

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
                { label: t('payment.bankName'), value: details.bankName },
                { label: t('payment.swiftCode'), value: details.swiftCode },
                { label: t('payment.accountNumber'), value: details.accountNumberMasked },
                { label: 'IBAN', value: details.ibanMasked },
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

            <View className="mt-4 bg-surface border-y border-border">
              <FieldRow
                label={`${t('payment.holderName')} *`}
                error={fieldErrors.holderName}
              >
                <TextInput
                  className="text-[15px] flex-1 py-0"
                  style={{ color: colors.text.primary }}
                  value={form.holderName}
                  onChangeText={(v) => set('holderName', v)}
                  onBlur={() => validateHolderName()}
                  placeholder={t('payment.holderName')}
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </FieldRow>
              <FieldRow label={`${t('payment.bankName')} *`} error={fieldErrors.bankName}>
                <TextInput
                  className="text-[15px] flex-1 py-0"
                  style={{ color: colors.text.primary }}
                  value={form.bankName}
                  onChangeText={(v) => set('bankName', v)}
                  onBlur={() => validateBankName()}
                  placeholder={t('payment.bankName')}
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </FieldRow>
              <FieldRow
                label={t('payment.swiftCode')}
                error={fieldErrors.swiftCode}
                hint={fieldErrors.swiftCode ? undefined : t('payment.swiftHint')}
              >
                <TextInput
                  className="text-[15px] flex-1 py-0"
                  style={{ color: colors.text.primary }}
                  value={form.swiftCode}
                  onChangeText={onSwiftChange}
                  onBlur={() => validateSwiftField()}
                  placeholder="RZBSRSBG"
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={11}
                  returnKeyType="next"
                />
              </FieldRow>
              <FieldRow
                label={`${t('payment.accountNumber')} *`}
                error={fieldErrors.accountNumber}
                hint={fieldErrors.accountNumber ? undefined : t('payment.accountNumberHint')}
              >
                <TextInput
                  className="text-[15px] flex-1 py-0"
                  style={{ color: colors.text.primary }}
                  value={form.accountNumber}
                  onChangeText={onAccountNumberChange}
                  onBlur={() => validateAccountField()}
                  placeholder={
                    details?.hasBankDetails
                      ? details.accountNumberMasked ?? '000-00000000-00'
                      : '000-00000000-00'
                  }
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  maxLength={34}
                  returnKeyType="next"
                />
              </FieldRow>
              <FieldRow
                label="IBAN"
                isLast
                error={fieldErrors.iban}
                hint={
                  fieldErrors.iban
                    ? undefined
                    : t('payment.ibanOptionalHint', { length: expectedIbanLength })
                }
              >
                <TextInput
                  className="text-[15px] flex-1 py-0"
                  style={{ color: colors.text.primary }}
                  value={form.iban}
                  onChangeText={onIbanChange}
                  onBlur={() => validateIbanField()}
                  placeholder={
                    details?.hasBankDetails ? details.ibanMasked ?? 'RS35 2600 ...' : 'RS35 2600 ...'
                  }
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={ibanMaxLength}
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

function FieldRow({
  label,
  children,
  isLast,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  error?: string;
  hint?: string;
}) {
  const hasError = Boolean(error);

  return (
    <View
      className="px-4 py-2.5"
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
