import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
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
import LegalAcceptanceCheckbox from '@/components/LegalAcceptanceCheckbox';
import { LEGAL_DOCS_VERSION, recordLocalLegalAcceptance } from '@/config/legal';
import { GOOGLE_WEB_CLIENT_ID } from '@/config/google';
import { AuthStackScreenProps } from '@/navigation/types';
import { googleLogin } from '@/services/authService';
import { completeCustomerAuth } from '@/services/customerAuthFlow';
import { registerCustomer } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

const schema = z
  .object({
    username: z.string().min(3, 'errors.required'),
    email: z.string().min(1, 'errors.required').email('errors.emailInvalid'),
    password: z.string().min(6, 'errors.passwordTooShort'),
    confirmPassword: z.string().min(1, 'errors.required'),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'errors.passwordMismatch',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;
type Props = AuthStackScreenProps<'CustomerRegister'>;

export default function CustomerRegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const storeLogin = useAuthStore(s => s.login);
  const setUser = useAuthStore(s => s.setUser);
  const logout = useAuthStore(s => s.logout);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  }, []);

  const onSubmit = async (data: FormData) => {
    try {
      await registerCustomer({
        username: data.username,
        email: data.email,
        password: data.password,
        termsVersion: LEGAL_DOCS_VERSION,
        privacyVersion: LEGAL_DOCS_VERSION,
      });
      void recordLocalLegalAcceptance();
      Alert.alert(t('common.success'), t('auth.emailVerificationSent'), [
        { text: t('common.ok'), onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        Alert.alert(t('common.error'), t('errors.conflict'));
      } else {
        Alert.alert(t('common.error'), t('errors.serverError'));
      }
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();

      if (!isSuccessResponse(result)) return;

      const idToken = result.data.idToken;
      if (!idToken) {
        Alert.alert(t('common.error'), t('auth.googleLoginFailed'));
        return;
      }

      const response = await googleLogin({ idToken, role: 'USER', isSignUp: true });
      GoogleSignin.signOut().catch(() => {});
      await storeLogin(response.token, response.refreshToken, response.user);
      // OAuth2 signup does not yet carry acceptance to the backend (known gap).
      // The checkbox gate is enforced above, so record acceptance locally for now.
      void recordLocalLegalAcceptance();

      try {
        const profile = await completeCustomerAuth(response);
        await setUser(profile);
      } catch {
        await logout();
        Alert.alert(t('common.error'), t('customer.profile.loadFailed'));
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (
          error.code === statusCodes.SIGN_IN_CANCELLED ||
          error.code === statusCodes.IN_PROGRESS
        ) {
          return;
        }
      }
      Alert.alert(t('common.error'), t('auth.googleLoginFailed'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isLoading = isSubmitting || isGoogleLoading;

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

          {/* Back */}
          <BackButton onPress={() => navigation.goBack()} className="mb-8" />

          <BrandLogo variant="icon" className="mb-6" />

          {/* Title */}
          <View className="mb-8 items-center">
            <Text className="text-2xl font-bold text-text-primary text-center">{t('auth.createAccount')}</Text>
            <Text className="text-text-secondary text-sm mt-1 text-center">{t('auth.beCustomerDesc')}</Text>
          </View>

          {/* Username */}
          <View className="mb-4">
            <Text className="text-text-primary text-sm font-medium mb-1">{t('auth.username')}</Text>
            <Controller
              control={control}
              name="username"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${
                    errors.username ? 'border-error' : 'border-border'
                  }`}
                  placeholder={t('auth.username')}
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isLoading}
                />
              )}
            />
            {errors.username && (
              <Text className="text-error text-xs mt-1">
                {t(errors.username.message ?? 'errors.required')}
              </Text>
            )}
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
                  editable={!isLoading}
                />
              )}
            />
            {errors.email && (
              <Text className="text-error text-xs mt-1">
                {t(errors.email.message ?? 'errors.required')}
              </Text>
            )}
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="text-text-primary text-sm font-medium mb-1">{t('auth.password')}</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  className={`flex-row items-center bg-surface border rounded-xl px-4 ${
                    errors.password ? 'border-error' : 'border-border'
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
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && (
              <Text className="text-error text-xs mt-1">
                {t(errors.password.message ?? 'errors.required')}
              </Text>
            )}
          </View>

          {/* Confirm password */}
          <View className="mb-8">
            <Text className="text-text-primary text-sm font-medium mb-1">{t('auth.confirmPassword')}</Text>
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
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.text.secondary} />
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

          {/* Terms & privacy acceptance */}
          <View className="mb-6">
            <LegalAcceptanceCheckbox
              checked={acceptedTerms}
              onToggle={() => setAcceptedTerms((v) => !v)}
              disabled={isLoading}
            />
          </View>

          {/* Create account button */}
          <TouchableOpacity
            className={`bg-primary rounded-xl py-4 items-center mb-4 ${
              !acceptedTerms || isLoading ? 'opacity-50' : ''
            }`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading || !acceptedTerms}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">{t('auth.createAccount')}</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mb-4">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-text-secondary text-sm mx-3">or</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Google sign up */}
          <TouchableOpacity
            className={`bg-surface border border-border rounded-xl py-4 items-center flex-row justify-center mb-8 ${
              !acceptedTerms || isLoading ? 'opacity-50' : ''
            }`}
            onPress={handleGoogleSignUp}
            disabled={isLoading || !acceptedTerms}
            activeOpacity={0.8}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Text className="text-lg mr-2">G</Text>
                <Text className="text-text-primary font-semibold text-base">{t('auth.googleSignUp')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign in link */}
          <View className="flex-row justify-center">
            <Text className="text-text-secondary text-sm">{t('auth.alreadyHaveAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
              <Text className="text-primary text-sm font-semibold">{t('auth.signIn')}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
