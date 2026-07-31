import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
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
import LocationMapPicker, { Coordinates } from '@/components/LocationMapPicker';
import OneTimeCredentialsModal from '@/components/OneTimeCredentialsModal';
import { DEV_LOCATION } from '@/config/devLocation';
import { VendorStackScreenProps } from '@/navigation/types';
import { addChainLocation, updateChainLocation } from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { LocationCreationResponse, LocationRequest } from '@/types';
import { handleInactiveAccount, mapChainError } from '@/utils/chainErrors';
import { getSupportedCountries, resolveCountryKey } from '@/utils/countryCodeMapper';

type Props = VendorStackScreenProps<'VendorLocationForm'>;

type GeoState = 'idle' | 'searching' | 'found' | 'error';

const SUPPORTED_COUNTRIES = getSupportedCountries();
const GEOCODE_DEBOUNCE_MS = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LocationFormScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const existing = route.params?.location ?? null;
  const isEdit = existing != null;

  const [locationName, setLocationName] = useState(existing?.locationName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [zipCode, setZipCode] = useState(existing?.zipCode ?? '');
  const [country, setCountry] = useState(
    resolveCountryKey(existing?.country ?? route.params?.defaultCountry) ?? 'Serbia',
  );
  const [coords, setCoords] = useState<Coordinates | null>(
    existing?.latitude != null && existing?.longitude != null
      ? { latitude: existing.latitude, longitude: existing.longitude }
      : null,
  );

  const [geoState, setGeoState] = useState<GeoState>(isEdit ? 'found' : 'idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<LocationCreationResponse | null>(null);

  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // On edit the saved coordinates are authoritative until the user actually changes the
  // address; without this the form would re-geocode on mount and silently move the pin.
  const hasEditedAddress = useRef(!isEdit);

  useEffect(() => {
    if (!hasEditedAddress.current) return;
    if (address.trim().length < 4 || !country) {
      setGeoState('idle');
      return;
    }

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      void geocode(address, zipCode, country, setGeoState, setCoords);
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [address, zipCode, country]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (locationName.trim().length === 0) errors.locationName = t('errors.required');
    if (!isEdit && !EMAIL_PATTERN.test(email.trim())) errors.email = t('errors.emailInvalid');
    if (phone.trim().length === 0) errors.phone = t('errors.required');
    if (address.trim().length === 0) errors.address = t('errors.required');
    if (coords == null) errors.coords = t('vendor.locationForm.pinRequired');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildRequest = (): LocationRequest => ({
    locationName: locationName.trim(),
    // Required by bean validation on update too, even though the update ignores it. Sending
    // the location's current address keeps the login identifier unchanged.
    email: email.trim(),
    phone: phone.trim(),
    address: address.trim(),
    zipCode: zipCode.trim() || undefined,
    latitude: coords!.latitude,
    longitude: coords!.longitude,
    country,
  });

  const onSubmit = () => {
    if (!validate()) return;
    if (isEdit) {
      Alert.alert(
        t('vendor.locationForm.saveConfirmTitle'),
        t('vendor.locationForm.saveConfirmMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.save'), onPress: () => void submit() },
        ],
      );
      return;
    }
    void submit();
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await updateChainLocation(existing.id, buildRequest());
        navigation.goBack();
        return;
      }

      const result = await addChainLocation(buildRequest());
      if (!result.emailSent) {
        // The generated password exists nowhere else once this response is discarded.
        setCredentials(result);
        return;
      }
      Alert.alert(
        t('vendor.locationAdded'),
        result.paymentAccountReady
          ? t('vendor.locationForm.createdReady', { email: result.email })
          : t('vendor.locationForm.createdNeedsPayout', { email: result.email }),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      if (await handleInactiveAccount(error)) return;
      handleSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitError = (error: unknown) => {
    const mapped = mapChainError(error);
    const message = t(mapped.key, { defaultValue: mapped.raw });

    if (mapped.field === 'email' || mapped.field === 'locationName') {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as string]: message }));
      return;
    }
    if (mapped.action === 'contactSupport') {
      Alert.alert(t('vendor.chainErrors.locationLimitTitle'), message, [
        {
          text: t('common.ok'),
          onPress: () =>
            navigation.navigate('VendorChainLocationManagement', {
              locationLimitReached: true,
            }),
        },
      ]);
      return;
    }
    if (mapped.action === 'goToProfile') {
      Alert.alert(t('common.error'), message, [
        { text: t('common.ok'), onPress: () => navigation.replace('VendorEditProfile') },
      ]);
      return;
    }
    Alert.alert(t('common.error'), message);
  };

  const canSubmit =
    locationName.trim().length > 0 &&
    phone.trim().length > 0 &&
    address.trim().length > 0 &&
    coords != null &&
    (isEdit || EMAIL_PATTERN.test(email.trim())) &&
    !isSubmitting;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        className="bg-surface border-b border-border px-5 pb-3.5 flex-row items-center gap-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Text className="flex-1 text-[17px] font-semibold text-text-primary">
          {isEdit ? t('vendor.locationForm.editTitle') : t('vendor.locationForm.addTitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label={`${t('vendor.locationForm.locationName')} *`} error={fieldErrors.locationName}>
          <Input
            value={locationName}
            onChangeText={(v) => {
              setLocationName(v);
              clearError('locationName', setFieldErrors);
            }}
            placeholder={t('vendor.locationForm.locationNamePlaceholder')}
            hasError={fieldErrors.locationName != null}
            editable={!isSubmitting}
          />
        </Field>

        <Field
          label={`${t('vendor.locationForm.email')}${isEdit ? '' : ' *'}`}
          error={fieldErrors.email}
          hint={isEdit ? t('vendor.locationForm.emailLocked') : t('vendor.locationForm.emailHint')}
        >
          <Input
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clearError('email', setFieldErrors);
            }}
            placeholder="location@example.rs"
            keyboardType="email-address"
            autoCapitalize="none"
            hasError={fieldErrors.email != null}
            /* Changing a location's login email is not supported by this endpoint. */
            editable={!isEdit && !isSubmitting}
          />
        </Field>

        <Field label={`${t('vendor.locationForm.phone')} *`} error={fieldErrors.phone}>
          <Input
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              clearError('phone', setFieldErrors);
            }}
            placeholder="+381601234567"
            keyboardType="phone-pad"
            hasError={fieldErrors.phone != null}
            editable={!isSubmitting}
          />
        </Field>

        <Field
          label={`${t('vendor.locationForm.address')} *`}
          error={fieldErrors.address}
          hint={t('vendor.locationForm.addressHint')}
        >
          <Input
            value={address}
            onChangeText={(v) => {
              hasEditedAddress.current = true;
              setAddress(v);
              clearError('address', setFieldErrors);
            }}
            placeholder={t('vendor.locationForm.addressPlaceholder')}
            hasError={fieldErrors.address != null}
            editable={!isSubmitting}
          />
        </Field>

        <Field label={t('auth.zipCode')}>
          <Input
            value={zipCode}
            onChangeText={(v) => {
              hasEditedAddress.current = true;
              setZipCode(v);
            }}
            placeholder="21000"
            keyboardType="numeric"
            editable={!isSubmitting}
          />
        </Field>

        <Field label={t('auth.country')}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {SUPPORTED_COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => {
                  hasEditedAddress.current = true;
                  setCountry(c);
                }}
                className="rounded-full px-3 py-1.5 border"
                style={{
                  backgroundColor: country === c ? colors.primary.DEFAULT : colors.surface,
                  borderColor: country === c ? colors.primary.DEFAULT : colors.border,
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: country === c ? '#fff' : colors.text.secondary }}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Field>

        {geoState !== 'idle' && (
          <GeoStatus state={geoState} coords={coords} />
        )}

        <LocationMapPicker
          value={coords}
          onChange={(next) => {
            setCoords(next);
            setGeoState('found');
            clearError('coords', setFieldErrors);
          }}
          isResolving={geoState === 'searching'}
          fallbackCenter={coords ?? DEV_LOCATION}
          editable={!isSubmitting}
        />
        {fieldErrors.coords ? (
          <Text className="text-error text-xs -mt-2 mb-3">{fieldErrors.coords}</Text>
        ) : null}

        <View
          className="rounded-xl px-4 py-3 mb-5 flex-row gap-2.5"
          style={{ backgroundColor: colors.primary[50] }}
        >
          <Feather name="info" size={16} color={colors.primary.DEFAULT} />
          <Text className="text-xs leading-4 flex-1 text-text-primary">
            {isEdit
              ? t('vendor.locationForm.editNotice')
              : t('vendor.locationForm.addNotice')}
          </Text>
        </View>

        <TouchableOpacity
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: canSubmit ? colors.primary.DEFAULT : colors.border }}
          onPress={onSubmit}
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
              {isEdit ? t('common.save') : t('vendor.addLocation')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <OneTimeCredentialsModal
        visible={credentials != null}
        title={t('vendor.locationForm.credentialsTitle')}
        description={t('vendor.locationForm.credentialsDesc', {
          email: credentials?.email ?? '',
        })}
        username={credentials?.username}
        password={credentials?.password}
        errorDetail={credentials?.emailError}
        onDismiss={() => {
          setCredentials(null);
          navigation.goBack();
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

/**
 * Android's built-in Geocoder mishandles Serbian diacritics and local address formats, so
 * this follows the same Nominatim path the headquarters setup step uses.
 */
async function geocode(
  address: string,
  zipCode: string,
  country: string,
  setGeoState: (s: GeoState) => void,
  setCoords: (c: Coordinates | null) => void,
): Promise<void> {
  setGeoState('searching');
  try {
    const query = `${address}, ${zipCode ? zipCode + ' ' : ''}${country}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'StillFreshApp/1.0', 'Accept-Language': 'sr' },
    });
    const data: Array<{ lat: string; lon: string }> = await res.json();
    if (data.length > 0) {
      setCoords({ latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) });
      setGeoState('found');
    } else {
      setGeoState('error');
    }
  } catch {
    setGeoState('error');
  }
}

function GeoStatus({ state, coords }: { state: GeoState; coords: Coordinates | null }) {
  const { t } = useTranslation();
  const isError = state === 'error';
  const tone = isError ? colors.warning : colors.primary.DEFAULT;

  return (
    <View
      className="rounded-xl px-4 py-3 flex-row items-center gap-2 mb-4"
      style={{ backgroundColor: isError ? `${colors.warning}24` : colors.primary[50] }}
    >
      {state === 'searching' ? (
        <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
      ) : (
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: tone }} />
      )}
      <Text className="text-sm flex-1" style={{ color: tone }}>
        {state === 'searching'
          ? t('vendor.onboarding.geocodingSearching')
          : state === 'found' && coords
            ? t('vendor.locationForm.geocodingFound')
            : t('vendor.locationForm.geocodingErrorUseMap')}
      </Text>
    </View>
  );
}

// ── Form primitives ───────────────────────────────────────────────────────────

function clearError(
  key: string,
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
): void {
  setFieldErrors((prev) => {
    if (prev[key] == null) return prev;
    const next = { ...prev };
    delete next[key];
    return next;
  });
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="text-text-primary text-sm font-medium mb-1">{label}</Text>
      {children}
      {error ? (
        <Text className="text-error text-xs mt-1">{error}</Text>
      ) : hint ? (
        <Text className="text-text-secondary text-xs mt-1">{hint}</Text>
      ) : null}
    </View>
  );
}

function Input({
  hasError,
  editable = true,
  ...props
}: React.ComponentProps<typeof TextInput> & { hasError?: boolean }) {
  return (
    <TextInput
      className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
      placeholderTextColor={colors.text.secondary}
      editable={editable}
      style={{
        borderColor: hasError
          ? colors.error
          : (props.value?.length ?? 0) > 0
            ? colors.primary.DEFAULT
            : colors.border,
        opacity: editable ? 1 : 0.6,
      }}
      {...props}
    />
  );
}
