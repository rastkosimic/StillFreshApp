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
import BrandLogo from '@/components/BrandLogo';
import { AuthStackScreenProps } from '@/navigation/types';
import { forgotPassword } from '@/services/authService';
import { colors } from '@/theme/colors';

const schema = z
  .object({
    email: z.string().min(1, 'errors.required').email('errors.emailInvalid'),
    newPassword: z.string().min(6, 'errors.passwordTooShort'),
    confirmPassword: z.string().min(1, 'errors.required'),
  })
  .refine(d => d.newPassword === d.confirmPassword, {
    message: 'errors.passwordMismatch',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;
type Props = AuthStackScreenProps<'RequestPasswordReset'>;

export default function RequestPasswordResetScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { email: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await forgotPassword(data.email, data.newPassword);
      Alert.alert(t('common.success'), t('auth.verificationLinkSent'), [
        { text: t('common.ok'), onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        Alert.alert(t('common.error'), t('errors.noAccountFound'));
      } else {
        Alert.alert(t('common.error'), t('errors.serverError'));
      }
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 py-10">

          {/* Back to login */}
          <BackButton onPress={() => navigation.navigate('Login')} className="mb-8" />

          <BrandLogo variant="icon" className="mb-6" />

          {/* Title */}
          <View className="mb-8 items-center">
            <Text className="text-2xl font-bold text-text-primary text-center">
              {t('auth.resetPasswordTitle')}
            </Text>
            <Text className="text-text-secondary text-sm mt-2 leading-5 text-center">
              {t('auth.resetPasswordDesc')}
            </Text>
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-text-primary text-sm font-medium mb-1">{t('auth.email')}</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${
                    errors.email ? 'border-error' : 'border-border'
                  }`}
                  placeholder={t('auth.enterEmail')}
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.email && (
              <Text className="text-error text-xs mt-1">
                {t(errors.email.message ?? 'errors.required')}
              </Text>
            )}
          </View>

          {/* New password */}
          <View className="mb-4">
            <Text className="text-text-primary text-sm font-medium mb-1">
              {t('auth.newPassword')}
            </Text>
            <Controller
              control={control}
              name="newPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  className={`flex-row items-center bg-surface border rounded-xl px-4 ${
                    errors.newPassword ? 'border-error' : 'border-border'
                  }`}
                >
                  <TextInput
                    className="flex-1 py-3 text-text-primary text-base"
                    placeholder={t('auth.enterPassword')}
                    placeholderTextColor={colors.text.secondary}
                    secureTextEntry={!showPassword}
                    textContentType="newPassword"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.newPassword && (
              <Text className="text-error text-xs mt-1">
                {t(errors.newPassword.message ?? 'errors.required')}
              </Text>
            )}
          </View>

          {/* Confirm password */}
          <View className="mb-10">
            <Text className="text-text-primary text-sm font-medium mb-1">
              {t('auth.confirmPassword')}
            </Text>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  className={`flex-row items-center bg-surface border rounded-xl px-4 ${
                    errors.confirmPassword ? 'border-error' : 'border-border'
                  }`}
                >
                  <TextInput
                    className="flex-1 py-3 text-text-primary text-base"
                    placeholder={t('auth.confirmPassword')}
                    placeholderTextColor={colors.text.secondary}
                    secureTextEntry={!showConfirm}
                    textContentType="newPassword"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirm(v => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
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
              <Text className="text-error text-xs mt-1">
                {t(errors.confirmPassword.message ?? 'errors.required')}
              </Text>
            )}
          </View>

          {/* Submit — disabled until form is valid */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${isValid ? 'bg-primary' : 'bg-primary-200'}`}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {t('auth.sendVerificationLink')}
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
