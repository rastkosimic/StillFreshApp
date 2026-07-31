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

import { OnboardingStackScreenProps } from '@/navigation/types';
import { addHeadquarters } from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { countryNameToCode, getSupportedCountries } from '@/utils/countryCodeMapper';

type Props = OnboardingStackScreenProps<'HeadquartersSetup'>;

type GeoState = 'idle' | 'searching' | 'found' | 'error';

interface Coords {
  latitude: number;
  longitude: number;
}

const SUPPORTED_COUNTRIES = getSupportedCountries();

export default function HeadquartersSetupScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const [locationName, setLocationName] = useState('');
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Serbia');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');

  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger geocoding 1s after address fields change
  useEffect(() => {
    if (!street || !city || !country) {
      setGeoState('idle');
      setCoords(null);
      return;
    }

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);

    geocodeTimer.current = setTimeout(async () => {
      setGeoState('searching');
      setCoords(null);
      try {
        // Use Nominatim directly — Android's built-in Geocoder (Google Maps) fails on
        // Serbian diacritics and local address formats; Nominatim handles them reliably.
        const query = `${street}${streetNumber ? ' ' + streetNumber : ''}, ${zipCode ? zipCode + ' ' : ''}${city}, ${country}`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'StillFreshApp/1.0',
            'Accept-Language': 'sr',
          },
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
    }, 1000);

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [street, streetNumber, city, zipCode, country]);

  const canContinue =
    locationName.trim().length > 0 &&
    street.trim().length > 0 &&
    streetNumber.trim().length > 0 &&
    city.trim().length > 0 &&
    country.trim().length > 0 &&
    zipCode.trim().length > 0 &&
    geoState === 'found' &&
    coords !== null;

  const onSubmit = async () => {
    if (!coords) return;
    setIsSubmitting(true);
    try {
      await addHeadquarters({
        locationName: locationName.trim(),
        address: `${street.trim()}${streetNumber.trim() ? ' ' + streetNumber.trim() : ''}, ${city.trim()}, ${country.trim()}`,
        zipCode: zipCode.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: phone.trim(),
        country: countryNameToCode(country),
      });
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      if (!httpStatus || httpStatus >= 500) {
        Alert.alert(t('common.error'), t('errors.serverError'));
        setIsSubmitting(false);
        return;
      }
      // 4xx = backend rejects re-submission (already added) — navigate forward anyway
    }
    navigation.navigate('OnboardingFlow');
    setIsSubmitting(false);
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
        <View className="px-6 py-10">
          <ProgressBar current={2} total={5} />

          <Text className="text-2xl font-bold text-text-primary mb-2 mt-6">
            {t('vendor.onboarding.hqTitle')}
          </Text>
          <Text className="text-text-secondary text-sm leading-5 mb-6">
            {t('vendor.onboarding.hqDesc')}
          </Text>

          <Field label={`${t('vendor.onboarding.hqLocationName')} *`}>
            <TextInput
              className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
              style={{ borderColor: locationName.length > 0 ? colors.primary.DEFAULT : colors.border }}
              value={locationName}
              onChangeText={setLocationName}
              placeholder={t('vendor.onboarding.hqLocationName')}
              placeholderTextColor={colors.text.secondary}
              editable={!isSubmitting}
            />
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label={`${t('auth.streetName')} *`}>
                <TextInput
                  className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
                  style={{ borderColor: street.length > 0 ? colors.primary.DEFAULT : colors.border }}
                  value={street}
                  onChangeText={setStreet}
                  placeholder={t('auth.streetName')}
                  placeholderTextColor={colors.text.secondary}
                  editable={!isSubmitting}
                />
              </Field>
            </View>
            <View style={{ width: 80 }}>
              <Field label={`${t('auth.streetNumber')} *`}>
                <TextInput
                  className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
                  style={{ borderColor: streetNumber.length > 0 ? colors.primary.DEFAULT : colors.border }}
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  placeholder="No."
                  placeholderTextColor={colors.text.secondary}
                  keyboardType="default"
                  editable={!isSubmitting}
                />
              </Field>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label={`${t('auth.city')} *`}>
                <TextInput
                  className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
                  style={{ borderColor: city.length > 0 ? colors.primary.DEFAULT : colors.border }}
                  value={city}
                  onChangeText={setCity}
                  placeholder={t('auth.city')}
                  placeholderTextColor={colors.text.secondary}
                  editable={!isSubmitting}
                />
              </Field>
            </View>
            <View style={{ width: 100 }}>
              <Field label={`${t('auth.zipCode')} *`}>
                <TextInput
                  className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
                  style={{ borderColor: zipCode.length > 0 ? colors.primary.DEFAULT : colors.border }}
                  value={zipCode}
                  onChangeText={setZipCode}
                  placeholder={t('auth.zipCode')}
                  placeholderTextColor={colors.text.secondary}
                  keyboardType="numeric"
                  editable={!isSubmitting}
                />
              </Field>
            </View>
          </View>

          <Field label={`${t('auth.country')} *`}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
            >
              {SUPPORTED_COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCountry(c)}
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

          <Field label={t('auth.phone')}>
            <TextInput
              className="bg-surface border rounded-xl px-4 py-3 text-text-primary text-base"
              style={{ borderColor: phone.length > 0 ? colors.primary.DEFAULT : colors.border }}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('auth.phone')}
              placeholderTextColor={colors.text.secondary}
              keyboardType="phone-pad"
              editable={!isSubmitting}
            />
          </Field>

          {/* Geocoding status */}
          {geoState !== 'idle' && (
            <View
              className="rounded-xl px-4 py-3 flex-row items-center gap-2 mb-6"
              style={{
                backgroundColor:
                  geoState === 'found'
                    ? colors.primary[50]
                    : geoState === 'error'
                      ? '#FFF3CD'
                      : colors.primary[50],
                borderWidth: 1.5,
                borderColor:
                  geoState === 'found'
                    ? colors.primary.DEFAULT
                    : geoState === 'error'
                      ? colors.warning
                      : colors.primary[200],
              }}
            >
              {geoState === 'searching' ? (
                <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
              ) : (
                <View
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      geoState === 'found' ? colors.primary.DEFAULT : colors.warning,
                  }}
                />
              )}
              <Text
                className="text-sm flex-1"
                style={{
                  color:
                    geoState === 'found'
                      ? colors.primary.DEFAULT
                      : geoState === 'error'
                        ? colors.warning
                        : colors.primary.DEFAULT,
                }}
              >
                {geoState === 'searching'
                  ? t('vendor.onboarding.geocodingSearching')
                  : geoState === 'found'
                    ? `📍 ${t('vendor.onboarding.geocodingFound')} (${coords?.latitude.toFixed(4)}, ${coords?.longitude.toFixed(4)})`
                    : t('vendor.onboarding.geocodingError')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: canContinue ? colors.primary.DEFAULT : colors.border }}
            onPress={onSubmit}
            disabled={!canContinue || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className="font-semibold text-base"
                style={{ color: canContinue ? '#fff' : colors.text.secondary }}
              >
                {t('common.continue')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('VendorTypeSelection')}
            activeOpacity={0.7}
            className="items-center py-3 mt-2"
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

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="flex-1 h-1 rounded-full"
          style={{
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-text-primary text-sm font-medium mb-1">{label}</Text>
      {children}
    </View>
  );
}
