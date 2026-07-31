import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
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
import { z } from 'zod';

import BackButton from '@/components/BackButton';
import { VendorStackScreenProps } from '@/navigation/types';
import { changePassword } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

const schema = z
  .object({
    newPassword: z.string().min(6, 'errors.passwordTooShort'),
    confirmPassword: z.string().min(1, 'errors.required'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'errors.passwordMismatch',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;
type Props = VendorStackScreenProps<'VendorResetPassword'>;

export default function VendorResetPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormData) => {
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
      await changePassword(user!.email, data.newPassword, data.confirmPassword);
      // Backend applies the change immediately and logs the session out server-side.
      // Clear all local auth state and storage — RootNavigator will redirect to Login.
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 52, paddingBottom: 32 }}>

          {/* Back */}
          <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: 28 }} />

          {/* Title */}
          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text.primary, marginBottom: 6 }}>
            {t('auth.changePasswordTitle')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20, marginBottom: 28 }}>
            {t('auth.changePasswordDesc')}
          </Text>

          {/* Email — pre-filled, read-only */}
          <Text style={labelStyle}>{t('auth.email')}</Text>
          <View style={[inputWrapStyle, { backgroundColor: colors.surface, marginBottom: 20 }]}>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text.secondary }}>
              {user?.email ?? ''}
            </Text>
            <Ionicons name="lock-closed-outline" size={16} color={colors.border} />
          </View>

          {/* New password */}
          <Text style={labelStyle}>{t('auth.newPassword')}</Text>
          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  inputWrapStyle,
                  { marginBottom: 4 },
                  errors.newPassword ? { borderColor: colors.error } : {},
                ]}
              >
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: colors.text.primary, paddingVertical: 0 }}
                  placeholder={t('auth.enterPassword')}
                  placeholderTextColor={colors.text.secondary}
                  secureTextEntry={!showNew}
                  textContentType="newPassword"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowNew((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons
                    name={showNew ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
          {errors.newPassword && (
            <Text style={errorTextStyle}>{t(errors.newPassword.message ?? 'errors.required')}</Text>
          )}

          {/* Confirm password */}
          <Text style={[labelStyle, { marginTop: 12 }]}>{t('auth.confirmPassword')}</Text>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  inputWrapStyle,
                  { marginBottom: 4 },
                  errors.confirmPassword ? { borderColor: colors.error } : {},
                ]}
              >
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: colors.text.primary, paddingVertical: 0 }}
                  placeholder={t('auth.confirmPassword')}
                  placeholderTextColor={colors.text.secondary}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
          {errors.confirmPassword && (
            <Text style={errorTextStyle}>{t(errors.confirmPassword.message ?? 'errors.required')}</Text>
          )}

          <View style={{ flex: 1 }} />

          {/* Warning banner */}
          <View style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-start',
            backgroundColor: '#FEF3CD',
            borderWidth: 1,
            borderColor: colors.warning,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 20,
          }}>
            <Ionicons name="warning-outline" size={16} color="#FF9500" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 13, color: '#7d4e00', lineHeight: 18 }}>
              {t('auth.changePasswordWarning')}
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={{
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: 'center',
              backgroundColor: isValid ? colors.primary.DEFAULT : colors.border,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: isValid ? '#fff' : colors.text.secondary }}>
                {t('auth.changePasswordBtn')}
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const labelStyle = {
  fontSize: 13,
  fontWeight: '500' as const,
  color: '#1C1C1E',
  marginBottom: 6,
};

const inputWrapStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#E5E5EA',
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  gap: 8,
};

const errorTextStyle = {
  fontSize: 12,
  color: '#FF3B30',
  marginTop: 4,
  marginBottom: 4,
};
