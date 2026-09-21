import { zodResolver } from '@hookform/resolvers/zod';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';

import BrandLogo from '@/components/BrandLogo';
import { brandAssets } from '@/config/brandAssets';
import { GOOGLE_WEB_CLIENT_ID } from '@/config/google';
import { AuthStackScreenProps } from '@/navigation/types';
import { googleLogin, login } from '@/services/authService';
import { completeAuthAfterLogin } from '@/services/postLoginAuth';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

// ── Šema validacije ────────────────────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().min(1, 'errors.required').email('errors.emailInvalid'),
  password: z.string().min(1, 'errors.required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ── Komponenta ────────────────────────────────────────────────────────────────

type Props = AuthStackScreenProps<'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const storeLogin = useAuthStore((s) => s.login);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const sessionEndedReason = useAuthStore((s) => s.sessionEndedReason);
  const clearSessionEndedReason = useAuthStore((s) => s.clearSessionEndedReason);

  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (sessionEndedReason === 'suspended') {
        clearSessionEndedReason();
        Alert.alert(t('common.error'), t('errors.accountSuspended'));
      } else if (sessionEndedReason === 'deactivated') {
        clearSessionEndedReason();
        Alert.alert(t('common.error'), t('errors.accountDeactivated'));
      }
    }, [sessionEndedReason, clearSessionEndedReason, t]),
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  // Konfiguriši Google prijavu jednom
  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  }, []);

  // ── Prijava emailom/lozinkom ───────────────────────────────────────────────

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await login(data.identifier, data.password);

      if (response.accountWasDeleted) {
        Alert.alert(t('common.success'), t('customer.profile.accountReactivated'));
      }

      await storeLogin(response.token, response.refreshToken, response.user);

      try {
        const profile = await completeAuthAfterLogin(response);
        await setUser(profile);
      } catch {
        await logout();
        const isVendor =
          response.user.role === 'VENDOR' || response.user.role === 'VENDOR_ADMIN';
        Alert.alert(
          t('common.error'),
          isVendor ? t('errors.serverError') : t('customer.profile.loadFailed'),
        );
      }
    } catch {
      Alert.alert(t('common.error'), t('errors.invalidCredentials'));
    }
  };

  // ── Google prijava ──────────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();

      if (!isSuccessResponse(result)) {
        // Korisnik otkazao ili nema kredencijala — ne radi ništa
        return;
      }

      const idToken = result.data.idToken;
      if (!idToken) {
        Alert.alert(t('common.error'), t('auth.googleLoginFailed'));
        return;
      }

      const response = await googleLogin({ idToken, role: 'USER', isSignUp: false });

      if (response.accountWasDeleted) {
        Alert.alert(t('common.success'), t('customer.profile.accountReactivated'));
      }

      // Odjavi se sa Google-a nakon uspešne backend prijave da bi se birač naloga
      // uvek pojavio pri sledećem pokušaju (ne blokira)
      GoogleSignin.signOut().catch(() => {});

      await storeLogin(response.token, response.refreshToken, response.user);

      try {
        const profile = await completeAuthAfterLogin(response);
        await setUser(profile);
      } catch {
        await logout();
        const isVendor =
          response.user.role === 'VENDOR' || response.user.role === 'VENDOR_ADMIN';
        Alert.alert(
          t('common.error'),
          isVendor ? t('errors.serverError') : t('customer.profile.loadFailed'),
        );
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          // Korisnik otkazao — ne radi ništa
          return;
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          return;
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert(t('common.error'), 'Google Play Services not available.');
          return;
        }
      }
      // Backend odbio — verovatno ne postoji nalog
      Alert.alert(t('common.error'), t('auth.googleLoginFailed'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // ── Prikaz ─────────────────────────────────────────────────────────────────

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
        <View className="flex-1 justify-center px-6 py-12">

          {/* Brending */}
          <View className="items-center mb-10">
            <BrandLogo variant="stacked" className="mb-2" />
            <Text className="text-text-secondary text-base mt-1">{t('auth.login')}</Text>
          </View>

          {/* Polje za email */}
          <View className="mb-4">
            <Text className="text-text-primary text-sm font-medium mb-1">
              {t('auth.email')}
            </Text>
            <Controller
              control={control}
              name="identifier"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${
                    errors.identifier ? 'border-error' : 'border-border'
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
            {errors.identifier && (
              <Text className="text-error text-xs mt-1">{t(errors.identifier.message ?? 'errors.required')}</Text>
            )}
          </View>

          {/* Polje za lozinku */}
          <View className="mb-2">
            <Text className="text-text-primary text-sm font-medium mb-1">
              {t('auth.password')}
            </Text>
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
                    textContentType="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text className="text-text-secondary text-sm">
                      {showPassword ? '🙈' : '👁️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && (
              <Text className="text-error text-xs mt-1">{t(errors.password.message ?? 'errors.required')}</Text>
            )}
          </View>

          {/* Zaboravljena lozinka */}
          <TouchableOpacity
            className="self-end mb-6"
            onPress={() => navigation.navigate('RequestPasswordReset')}
            disabled={isLoading}
          >
            <Text className="text-primary text-sm">{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          {/* Dugme za prijavu */}
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center mb-4"
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">{t('auth.signIn')}</Text>
            )}
          </TouchableOpacity>

          {/* Razdelnik */}
          <View className="flex-row items-center mb-4">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-text-secondary text-sm mx-3">{t('auth.or')}</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Dugme za Google prijavu */}
          <TouchableOpacity
            className="bg-surface border border-border rounded-xl py-4 items-center flex-row justify-center mb-8"
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Image
                  source={brandAssets.googleG}
                  className="w-5 h-5 mr-2"
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
                <Text className="text-text-primary font-semibold text-base">
                  {t('auth.googleSignIn')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Link za registraciju */}
          <View className="flex-row justify-center">
            <Text className="text-text-secondary text-sm">{t('auth.dontHaveAccount')} </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('RoleSelection')}
              disabled={isLoading}
            >
              <Text className="text-primary text-sm font-semibold">{t('auth.signUp')}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
