import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { AuthStackScreenProps } from '@/navigation/types';
import { applyVendor } from '@/services/vendorService';
import { colors } from '@/theme/colors';

const schema = z.object({
  contactPerson: z.string().min(1, 'errors.required'),
  email: z.string().min(1, 'errors.required').email('errors.emailInvalid'),
  phone: z.string().min(1, 'errors.required'),
  locationName: z.string().min(1, 'errors.required'),
  streetNumber: z.string().min(1, 'errors.required'),
  streetName: z.string().min(1, 'errors.required'),
  city: z.string().min(1, 'errors.required'),
  state: z.string().min(1, 'errors.required'),
  zipCode: z.string().min(1, 'errors.required'),
  businessRegistrationId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type Props = AuthStackScreenProps<'VendorRegister'>;

function FieldLabel({ label }: { label: string }) {
  return <Text className="text-text-primary text-sm font-medium mb-1">{label}</Text>;
}

type GeoState = 'idle' | 'searching' | 'found' | 'error';

export default function VendorRegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      contactPerson: '',
      email: '',
      phone: '',
      locationName: '',
      streetNumber: '',
      streetName: '',
      city: '',
      state: '',
      zipCode: '',
      businessRegistrationId: '',
    },
  });

  const [streetName, streetNumber, city, zipCode, state] = useWatch({
    control,
    name: ['streetName', 'streetNumber', 'city', 'zipCode', 'state'],
  });

  useEffect(() => {
    if (!streetName || !city) {
      setGeoState('idle');
      setGeoCoords(null);
      return;
    }

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);

    geocodeTimer.current = setTimeout(async () => {
      setGeoState('searching');
      setGeoCoords(null);
      try {
        const query = `${streetNumber ? streetNumber + ' ' : ''}${streetName}, ${zipCode ? zipCode + ' ' : ''}${city}, ${state ?? ''}`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'StillFreshApp/1.0', 'Accept-Language': 'sr' } });
        const data: Array<{ lat: string; lon: string }> = await res.json();
        if (data.length > 0) {
          setGeoCoords({ latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) });
          setGeoState('found');
        } else {
          setGeoState('error');
        }
      } catch {
        setGeoState('error');
      }
    }, 1000);

    return () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); };
  }, [streetName, streetNumber, city, zipCode, state]);

  const onSubmit = async (data: FormData) => {
    const businessAddress = `${data.streetNumber} ${data.streetName}, ${data.city}, ${data.state}, ${data.zipCode}`;

    try {
      await applyVendor({
        email: data.email,
        phone: data.phone,
        businessAddress,
        locationName: data.locationName,
        zipCode: data.zipCode,
        businessRegistrationId: data.businessRegistrationId || undefined,
        contactPerson: data.contactPerson,
        termsVersion: LEGAL_DOCS_VERSION,
        privacyVersion: LEGAL_DOCS_VERSION,
        ...(geoCoords ?? {}),
      });
      void recordLocalLegalAcceptance();
      navigation.navigate('VendorApplicationSubmitted');
    } catch {
      Alert.alert(t('common.error'), t('errors.serverError'));
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

          {/* Back */}
          <BackButton onPress={() => navigation.goBack()} className="mb-8" />

          <BrandLogo variant="icon" className="mb-6" />

          {/* Title */}
          <View className="mb-6 items-center">
            <Text className="text-2xl font-bold text-text-primary text-center">{t('auth.vendorApply')}</Text>
            <Text className="text-text-secondary text-sm mt-1 text-center">{t('auth.beVendorDesc')}</Text>
          </View>

          {/* Info banner */}
          <View className="bg-warning/10 border border-warning rounded-xl px-4 py-3 mb-6 items-center" style={{ gap: 8 }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text className="text-text-primary text-sm leading-5 text-center">
              {t('auth.vendorApplicationInfo')}
            </Text>
          </View>

          {/* ── Contact details ── */}
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
            Contact details
          </Text>

          {/* Contact person */}
          <View className="mb-4">
            <FieldLabel label={t('auth.contactPerson')} />
            <Controller
              control={control}
              name="contactPerson"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.contactPerson ? 'border-error' : 'border-border'}`}
                  placeholder={t('auth.contactPerson')}
                  placeholderTextColor={colors.text.secondary}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.contactPerson && (
              <Text className="text-error text-xs mt-1">{t(errors.contactPerson.message ?? 'errors.required')}</Text>
            )}
          </View>

          {/* Email */}
          <View className="mb-4">
            <FieldLabel label={t('auth.email')} />
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.email ? 'border-error' : 'border-border'}`}
                  placeholder={t('auth.enterEmail')}
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="none"
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
              <Text className="text-error text-xs mt-1">{t(errors.email.message ?? 'errors.required')}</Text>
            )}
          </View>

          {/* Phone */}
          <View className="mb-4">
            <FieldLabel label={t('auth.phone')} />
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.phone ? 'border-error' : 'border-border'}`}
                  placeholder="+381 60 000 0000"
                  placeholderTextColor={colors.text.secondary}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.phone && (
              <Text className="text-error text-xs mt-1">{t(errors.phone.message ?? 'errors.required')}</Text>
            )}
          </View>

          {/* Location name */}
          <View className="mb-6">
            <FieldLabel label={t('auth.locationName')} />
            <Controller
              control={control}
              name="locationName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.locationName ? 'border-error' : 'border-border'}`}
                  placeholder={t('auth.locationName')}
                  placeholderTextColor={colors.text.secondary}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.locationName && (
              <Text className="text-error text-xs mt-1">{t(errors.locationName.message ?? 'errors.required')}</Text>
            )}
          </View>

          {/* ── Business address ── */}
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
            Business address
          </Text>

          {/* Street number + name side by side */}
          <View className="flex-row mb-4" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label={t('auth.streetNumber')} />
              <Controller
                control={control}
                name="streetNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.streetNumber ? 'border-error' : 'border-border'}`}
                    placeholder="12"
                    placeholderTextColor={colors.text.secondary}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                )}
              />
              {errors.streetNumber && (
                <Text className="text-error text-xs mt-1">{t('errors.required')}</Text>
              )}
            </View>
            <View style={{ flex: 2 }}>
              <FieldLabel label={t('auth.streetName')} />
              <Controller
                control={control}
                name="streetName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.streetName ? 'border-error' : 'border-border'}`}
                    placeholder={t('auth.streetName')}
                    placeholderTextColor={colors.text.secondary}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                )}
              />
              {errors.streetName && (
                <Text className="text-error text-xs mt-1">{t('errors.required')}</Text>
              )}
            </View>
          </View>

          {/* City */}
          <View className="mb-4">
            <FieldLabel label={t('auth.city')} />
            <Controller
              control={control}
              name="city"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.city ? 'border-error' : 'border-border'}`}
                  placeholder={t('auth.city')}
                  placeholderTextColor={colors.text.secondary}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.city && (
              <Text className="text-error text-xs mt-1">{t(errors.city.message ?? 'errors.required')}</Text>
            )}
          </View>

          {/* State + ZIP side by side */}
          <View className="flex-row mb-6" style={{ gap: 10 }}>
            <View style={{ flex: 2 }}>
              <FieldLabel label={t('auth.state')} />
              <Controller
                control={control}
                name="state"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.state ? 'border-error' : 'border-border'}`}
                    placeholder={t('auth.state')}
                    placeholderTextColor={colors.text.secondary}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                )}
              />
              {errors.state && (
                <Text className="text-error text-xs mt-1">{t('errors.required')}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label={t('auth.zipCode')} />
              <Controller
                control={control}
                name="zipCode"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`bg-surface border rounded-xl px-4 py-3 text-text-primary text-base ${errors.zipCode ? 'border-error' : 'border-border'}`}
                    placeholder="11000"
                    placeholderTextColor={colors.text.secondary}
                    keyboardType="numeric"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                )}
              />
              {errors.zipCode && (
                <Text className="text-error text-xs mt-1">{t('errors.required')}</Text>
              )}
            </View>
          </View>

          {/* Geocoding status */}
          {geoState !== 'idle' && (
            <View style={{
              borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
              backgroundColor: geoState === 'found' ? '#F0FFF4' : geoState === 'error' ? '#FFF5F5' : colors.surface,
              borderWidth: 1,
              borderColor: geoState === 'found' ? colors.primary.DEFAULT : geoState === 'error' ? colors.error : colors.border,
            }}>
              <Text style={{
                fontSize: 12,
                color: geoState === 'found' ? colors.primary.DEFAULT : geoState === 'error' ? colors.error : colors.text.secondary,
              }}>
                {geoState === 'searching'
                  ? t('vendor.onboarding.geocodingSearching')
                  : geoState === 'found'
                    ? `📍 ${t('vendor.onboarding.geocodingFound')} (${geoCoords?.latitude.toFixed(4)}, ${geoCoords?.longitude.toFixed(4)})`
                    : t('vendor.onboarding.geocodingError')}
              </Text>
            </View>
          )}

          {/* ── Optional ── */}
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
            {t('common.optional')}
          </Text>

          {/* Business registration ID */}
          <View className="mb-8">
            <FieldLabel label={t('auth.businessRegistrationId')} />
            <Controller
              control={control}
              name="businessRegistrationId"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-base"
                  placeholder={t('auth.businessRegistrationId')}
                  placeholderTextColor={colors.text.secondary}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
          </View>

          {/* Terms & privacy acceptance */}
          <View className="mb-6">
            <LegalAcceptanceCheckbox
              checked={acceptedTerms}
              onToggle={() => setAcceptedTerms((v) => !v)}
              role="VENDOR"
              disabled={isSubmitting}
            />
          </View>

          {/* Submit button */}
          <TouchableOpacity
            className={`bg-primary rounded-xl py-4 items-center mb-6 ${
              !acceptedTerms || isSubmitting ? 'opacity-50' : ''
            }`}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting || !acceptedTerms}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">{t('auth.submitApplication')}</Text>
            )}
          </TouchableOpacity>

          {/* Sign in link */}
          <View className="flex-row justify-center">
            <Text className="text-text-secondary text-sm">{t('auth.alreadyHaveAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isSubmitting}>
              <Text className="text-primary text-sm font-semibold">{t('auth.signIn')}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
