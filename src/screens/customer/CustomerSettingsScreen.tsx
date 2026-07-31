import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { z } from 'zod';

import BackButton from '@/components/BackButton';
import { LEGAL_URLS, openLegalUrl } from '@/config/legal';
import { CustomerStackScreenProps } from '@/navigation/types';
import { changePassword } from '@/services/authService';
import { deleteAccount } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

type Props = CustomerStackScreenProps<'CustomerSettings'>;

const passwordSchema = z
  .object({
    newPassword: z.string().min(6, 'errors.passwordTooShort'),
    confirmPassword: z.string().min(1, 'errors.required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'errors.passwordMismatch',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function CustomerSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onChangePassword = async (data: PasswordFormData) => {
    if (user?.email == null) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('auth.changePasswordConfirmTitle'),
        t('auth.changePasswordConfirmMsg'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.continue'), style: 'destructive', onPress: () => resolve(true) },
        ],
      );
    });

    if (!confirmed) return;

    try {
      await changePassword(user.email, data.newPassword, data.confirmPassword);
      reset();
      await logout();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        Alert.alert(t('common.error'), t('errors.sessionExpired'));
      } else if (status === 400) {
        Alert.alert(t('common.error'), t('errors.emailMismatch'));
      } else {
        Alert.alert(t('common.error'), t('errors.serverError'));
      }
    }
  };

  const onDeleteAccount = () => {
    Alert.alert(
      t('customer.profile.deleteAccountConfirmTitle'),
      t('customer.profile.deleteAccountConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccount();
              await logout();
            } catch {
              Alert.alert(t('common.error'), t('errors.serverError'));
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="px-4 pb-4 flex-row items-center"
          style={{ paddingTop: insets.top + 12 }}
        >
          <BackButton onPress={() => navigation.goBack()} className="mr-3" />
          <Text className="text-2xl font-bold text-text-primary flex-1">
            {t('customer.profile.settings')}
          </Text>
        </View>

        <SectionLabel label={t('customer.profile.sectionSecurity')} />
        <View className="mx-4 mb-6 bg-surface rounded-[14px] px-4 py-4 border border-border">
          <Text className="text-base font-semibold text-text-primary mb-1">
            {t('auth.changePassword')}
          </Text>
          <Text className="text-sm text-text-secondary mb-4">
            {t('customer.profile.changePasswordDesc')}
          </Text>

          <Text className="text-sm font-medium text-text-primary mb-1">{t('auth.newPassword')}</Text>
          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                className={`flex-row items-center bg-background border rounded-xl px-4 mb-3 ${
                  errors.newPassword ? 'border-error' : 'border-border'
                }`}
              >
                <TextInput
                  className="flex-1 py-3 text-text-primary text-base"
                  secureTextEntry={!showNewPassword}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword((current) => !current)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
          {errors.newPassword && (
            <Text className="text-error text-xs mb-3">
              {t(errors.newPassword.message ?? 'errors.required')}
            </Text>
          )}

          <Text className="text-sm font-medium text-text-primary mb-1">
            {t('auth.confirmPassword')}
          </Text>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                className={`flex-row items-center bg-background border rounded-xl px-4 mb-3 ${
                  errors.confirmPassword ? 'border-error' : 'border-border'
                }`}
              >
                <TextInput
                  className="flex-1 py-3 text-text-primary text-base"
                  secureTextEntry={!showConfirmPassword}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((current) => !current)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
          {errors.confirmPassword && (
            <Text className="text-error text-xs mb-3">
              {t(errors.confirmPassword.message ?? 'errors.required')}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleSubmit(onChangePassword)}
            disabled={!isValid || isSubmitting}
            className={`bg-primary rounded-xl py-4 items-center ${
              !isValid || isSubmitting ? 'opacity-50' : ''
            }`}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">{t('auth.changePassword')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <SectionLabel label={t('customer.profile.sectionNotifications')} />
        <View className="mx-4 mb-6 bg-surface rounded-[14px] overflow-hidden border border-border">
          <SettingsRow
            icon="notifications-outline"
            label={t('notifications.preferences')}
            onPress={() => navigation.navigate('NotificationPreferences')}
          />
        </View>

        <SectionLabel label={t('legal.sectionTitle')} />
        <View className="mx-4 mb-6 bg-surface rounded-[14px] overflow-hidden border border-border">
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t('legal.privacyPolicy')}
            onPress={() => void openLegalUrl(LEGAL_URLS.privacy)}
          />
          <SettingsRow
            icon="document-text-outline"
            label={t('legal.termsOfUse')}
            onPress={() => void openLegalUrl(LEGAL_URLS.termsCustomer)}
          />
        </View>

        <SectionLabel label={t('customer.profile.sectionAccount')} />
        <View className="mx-4 mb-6 bg-surface rounded-[14px] overflow-hidden border border-border">
          <SettingsRow
            icon="trash-outline"
            label={t('customer.profile.deleteAccount')}
            onPress={onDeleteAccount}
            destructive
            disabled={isDeleting}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="px-4 pb-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
      {label}
    </Text>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  destructive,
  disabled,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
      className={`flex-row items-center px-4 py-4 ${disabled ? 'opacity-50' : ''}`}
    >
      <Ionicons
        name={icon}
        size={22}
        color={destructive ? colors.error : colors.text.secondary}
      />
      <Text
        className={`flex-1 text-base ml-3 ${
          destructive ? 'text-error' : 'text-text-primary'
        }`}
      >
        {label}
      </Text>
      {!destructive && (
        <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
      )}
    </TouchableOpacity>
  );
}
