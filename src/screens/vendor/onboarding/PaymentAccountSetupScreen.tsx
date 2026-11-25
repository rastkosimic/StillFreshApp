import { useEffect, useState } from 'react';
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

import HolderNameLinesInput from '@/components/HolderNameLinesInput';
import { OnboardingStackScreenProps } from '@/navigation/types';
import { getPaymentStatus, saveMoRBankDetails } from '@/services/vendorPaymentService';
import { getOnboardingStatus, setupPaymentAccount } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { PayoutModel } from '@/types';
import { mapChainError } from '@/utils/chainErrors';
import {
  ACCOUNT_NUMBER_INPUT_MAX_LENGTH,
  EMPTY_HOLDER_NAME_LINES,
  formatAccountNumberInput,
  holderNameLineError,
  isCompleteAccountInput,
  joinHolderNameLines,
  validateAccountNumber,
  type HolderNameLines,
} from '@/utils/formatBankDetails';

type Props = OnboardingStackScreenProps<'PaymentAccountSetup'>;

type FieldKey = 'holderName' | 'accountNumber';
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function PaymentAccountSetupScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { isUniqueVendor } = route.params;
  const setUser = useAuthStore((s) => s.setUser);

  const step = isUniqueVendor ? 3 : 5;
  const total = isUniqueVendor ? 4 : 5;

  const [payoutModel, setPayoutModel] = useState<PayoutModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [holderLines, setHolderLines] = useState<HolderNameLines>(EMPTY_HOLDER_NAME_LINES);
  const [holderOverflow, setHolderOverflow] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stayLoading = false;
      try {
        const [status, payment] = await Promise.all([
          getOnboardingStatus().catch(() => null),
          getPaymentStatus().catch(() => null),
        ]);
        if (cancelled) return;

        // HQ-created branch locations never use this wizard — exit to the dashboard.
        if (status?.isChainLocation === true && status.isHeadquarters !== true) {
          stayLoading = true;
          const user = useAuthStore.getState().user;
          if (user) {
            await setUser({ ...user, profileCompleted: true });
          }
          return;
        }

        setPayoutModel(payment?.payoutModel ?? 'MOR');
      } finally {
        if (!cancelled && !stayLoading) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const isMoR = payoutModel !== null && payoutModel !== 'CONNECT';
  const parsedAccount = isMoR ? validateAccountNumber(accountNumber) : null;
  const canSubmit = isMoR
    ? holderNameLineError(holderLines) === null && !holderOverflow && parsedAccount?.ok === true
    : true;

  const clearFieldError = (key: FieldKey) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const setFieldError = (key: FieldKey, message: string) =>
    setFieldErrors((prev) => ({ ...prev, [key]: message }));

  const validateMoRForm = (): boolean => {
    const next: FieldErrors = {};

    const nameError = holderOverflow
      ? t('payment.holderNameTooLong')
      : holderNameLineError(holderLines) === 'gap'
        ? t('payment.holderNameGap')
        : holderNameLineError(holderLines) === 'empty'
          ? t('payment.fieldRequired')
          : null;
    if (nameError) next.holderName = nameError;

    const account = validateAccountNumber(accountNumber);
    if (!account.ok) {
      next.accountNumber =
        account.reason === 'empty'
          ? t('payment.fieldRequired')
          : account.reason === 'checksum'
            ? t('payment.accountNumberChecksumInvalid')
            : t('payment.accountNumberInvalid');
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (isMoR && !validateMoRForm()) {
      return;
    }

    setIsSubmitting(true);

    if (isMoR) {
      try {
        const account = validateAccountNumber(accountNumber);
        if (!account.ok) {
          setIsSubmitting(false);
          return;
        }
        await saveMoRBankDetails({
          holderName: joinHolderNameLines(holderLines),
          accountNumber: account.accountNumber,
          payoutMethod: 'BANK',
        });
      } catch (err: unknown) {
        const mapped = mapChainError(err);
        const message = t(mapped.key, { defaultValue: mapped.raw });
        if (mapped.field === 'accountNumber' || /account/i.test(mapped.raw)) {
          setFieldError('accountNumber', message);
        } else if (mapped.field === 'holderName') {
          setFieldError('holderName', message);
        }

        Alert.alert(t('common.error'), message || t('errors.serverError'));
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await setupPaymentAccount();
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      if (!httpStatus || httpStatus >= 500) {
        Alert.alert(t('common.error'), t('errors.serverError'));
        setIsSubmitting(false);
        return;
      }
      // 4xx = already configured — navigate forward anyway
    }

    navigation.navigate('OnboardingFlow');
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 40 }}>
          <ProgressBar current={step} total={total} />

          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text.primary, marginTop: 24, marginBottom: 6 }}>
            {t('vendor.onboarding.paymentTitle')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20, marginBottom: 24 }}>
            {isMoR ? t('vendor.onboarding.paymentDescMor') : t('vendor.onboarding.paymentDescConnect')}
          </Text>

          {/* ── MoR bank detail form ── */}
          {isMoR && (
            <>
              <SectionLabel label={t('vendor.onboarding.paymentMorTitle')} />

              {/* Security note — above the form so vendors see it before entering data */}
              <View style={{
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: '#FEF3CD',
                borderWidth: 1,
                borderColor: colors.warning,
                marginBottom: 12,
              }}>
                <Text style={{ fontSize: 12, lineHeight: 18, color: '#7d4e00' }}>
                  🔒 {t('vendor.onboarding.paymentSecurityNote')}
                </Text>
              </View>

              <FormCard>
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <HolderNameLinesInput
                    lines={holderLines}
                    error={fieldErrors.holderName}
                    onChange={(lines, overflow) => {
                      setHolderLines(lines);
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
                <Divider />
                <InlineRow
                  label={t('payment.accountNumber')}
                  required
                  value={accountNumber}
                  onChangeText={(v) => {
                    const formatted = formatAccountNumberInput(v);
                    setAccountNumber(formatted);
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
                  }}
                  placeholder="160-0000000380290-23"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={ACCOUNT_NUMBER_INPUT_MAX_LENGTH}
                  error={fieldErrors.accountNumber}
                  hint={fieldErrors.accountNumber ? undefined : t('payment.accountNumberHint')}
                />
              </FormCard>


            </>
          )}

          {/* ── Stripe Connect info ── */}
          {!isMoR && payoutModel !== null && (
            <>
              <View style={{
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
                backgroundColor: '#f0efff',
                borderWidth: 1.5,
                borderColor: '#635BFF',
              }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#635BFF', marginBottom: 4 }}>
                  💳 {t('vendor.onboarding.paymentConnectTitle')}
                </Text>
                <Text style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 18 }}>
                  {t('vendor.onboarding.paymentConnectDesc')}
                </Text>
              </View>

              <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 10 }}>
                  {t('vendor.onboarding.paymentConnectHow')}
                </Text>
                {(['paymentConnectStep1', 'paymentConnectStep2', 'paymentConnectStep3'] as const).map((key) => (
                  <View key={key} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.DEFAULT, marginTop: 6 }} />
                    <Text style={{ fontSize: 13, color: colors.text.secondary, flex: 1, lineHeight: 18 }}>
                      {t(`vendor.onboarding.${key}`)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FEF3CD', borderWidth: 1, borderColor: colors.warning, marginBottom: 8 }}>
                <Text style={{ fontSize: 12, lineHeight: 18, color: '#7d4e00' }}>
                  🔒 {t('vendor.onboarding.paymentSecurityNote')}
                </Text>
              </View>
            </>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={{
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: 'center',
              marginTop: 24,
              backgroundColor: canSubmit ? (isMoR ? colors.primary.DEFAULT : '#635BFF') : colors.border,
            }}
            onPress={onSubmit}
            disabled={!canSubmit || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: canSubmit ? '#fff' : colors.text.secondary }}>
                {isMoR ? t('vendor.onboarding.paymentSetupBtn') : t('vendor.onboarding.paymentConnectBtn')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              isUniqueVendor
                ? navigation.navigate('VendorProfileCompletion', {
                    isUniqueVendor: true,
                    currentStatus: 'BANKING_SETUP',
                  })
                : navigation.navigate('OnboardingFlow')
            }
            activeOpacity={0.7}
            style={{ alignItems: 'center', paddingVertical: 12, marginTop: 8 }}
          >
            <Text style={{ color: colors.text.secondary, fontSize: 15, fontWeight: '600' }}>
              {t('common.back')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor:
              i < current - 1
                ? colors.primary.DEFAULT
                : i === current - 1
                  ? colors.accent.DEFAULT
                  : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function SectionLabel({ label, style }: { label: string; style?: object }) {
  return (
    <Text style={[{ fontSize: 11, fontWeight: '700', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }, style]}>
      {label}
    </Text>
  );
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    }}>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#F2F2F7', marginHorizontal: 16 }} />;
}

function InlineRow({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'numbers-and-punctuation';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  error?: string;
  hint?: string;
}) {
  const hasError = Boolean(error);

  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: hasError ? `${colors.error}08` : undefined,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text
          style={{
            fontSize: 15,
            color: hasError ? colors.error : colors.text.primary,
            width: 110,
          }}
        >
          {label}
          {required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#C7C7CC"
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect ?? false}
          maxLength={maxLength}
          style={{
            flex: 1,
            fontSize: 15,
            color: colors.text.primary,
            textAlign: 'right',
            borderWidth: 1,
            borderColor: hasError ? colors.error : 'transparent',
            borderRadius: 8,
            paddingHorizontal: hasError ? 8 : 0,
            paddingVertical: hasError ? 6 : 0,
          }}
        />
      </View>
      {error ? (
        <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 16, color: colors.error }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 16, color: colors.text.secondary }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
