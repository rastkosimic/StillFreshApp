import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import {
  BUSINESS_TYPES,
  BusinessType,
  CERTIFICATIONS,
  EnvironmentalCertification,
  OPERATING_DAYS,
  OperatingDay,
  SURPLUS_FOOD_TYPES,
  SurplusFoodType,
} from '@/config/vendorProfile';
import { VendorStackScreenProps } from '@/navigation/types';
import { uploadVendorProfileImage } from '@/services/imageService';
import { getVendorProfile, updateVendorProfile } from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { countryNameToCode, getSupportedCountries } from '@/utils/countryCodeMapper';
import { decodeJWTPayload } from '@/utils/jwtDecoder';

type Props = VendorStackScreenProps<'VendorEditProfile'>;

type GeoState = 'idle' | 'searching' | 'found' | 'error';

interface Coords { latitude: number; longitude: number; }

const SUPPORTED_COUNTRIES = getSupportedCountries();

export default function VendorEditProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  // ── Remote image ──────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  // ── Business info ─────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [aboutBusiness, setAboutBusiness] = useState('');
  const [website, setWebsite] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [foodTypes, setFoodTypes] = useState<SurplusFoodType[]>([]);
  const [days, setDays] = useState<OperatingDay[]>([]);
  const [certifications, setCertifications] = useState<EnvironmentalCertification[]>([]);

  // ── Contact ───────────────────────────────────────────────────────────────
  const [contactPerson, setContactPerson] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // ── Address (editable, with geocoding) ───────────────────────────────────
  const [currentAddress, setCurrentAddress] = useState(''); // read from profile, shown as hint
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('Serbia');
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [coords, setCoords] = useState<Coords | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Screen state ──────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Initial snapshot for dirty detection ─────────────────────────────────
  const [initial, setInitial] = useState<{
    imageUrl: string | null;
    username: string;
    aboutBusiness: string;
    website: string;
    businessType: BusinessType | null;
    foodTypes: SurplusFoodType[];
    days: OperatingDay[];
    certifications: EnvironmentalCertification[];
    contactPerson: string;
    phoneNumber: string;
  } | null>(null);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (user == null || token == null) { setIsLoading(false); return; }
    const payload = decodeJWTPayload(token);
    const vendorId = (payload?.userId as number | undefined) || user.id;
    if (!vendorId) { setIsLoading(false); return; }

    getVendorProfile(vendorId)
      .then((profile) => {
        const snap = {
          imageUrl: profile.imageUrl ?? null,
          username: profile.locationName ?? '',
          aboutBusiness: profile.aboutBusiness ?? '',
          website: profile.website ?? '',
          businessType: (profile.businessType as BusinessType | undefined) ?? null,
          foodTypes: (profile.surplusFoodDetails ?? []) as SurplusFoodType[],
          days: (profile.operatingHours ?? []) as OperatingDay[],
          certifications: profile.environmentalCertifications
            ? (profile.environmentalCertifications.split(',').filter(Boolean) as EnvironmentalCertification[])
            : [],
          contactPerson: profile.contactPerson ?? '',
          phoneNumber: profile.phone ?? '',
        };
        setImageUrl(snap.imageUrl);
        setUsername(snap.username);
        setAboutBusiness(snap.aboutBusiness);
        setWebsite(snap.website);
        setBusinessType(snap.businessType);
        setFoodTypes(snap.foodTypes);
        setDays(snap.days);
        setCertifications(snap.certifications);
        setContactPerson(snap.contactPerson);
        setPhoneNumber(snap.phoneNumber);
        setCurrentAddress(profile.address ?? '');
        setInitial(snap);
      })
      .catch(() => {
        setInitial({
          imageUrl: null, username: '', aboutBusiness: '', website: '',
          businessType: null, foodTypes: [], days: [], certifications: [], contactPerson: '', phoneNumber: '',
        });
      })
      .finally(() => setIsLoading(false));
  }, [user, token]);

  // ── Geocoding — fires 1s after address fields change ─────────────────────
  const addressChanged = street.trim().length > 0 || streetNumber.trim().length > 0 || city.trim().length > 0;

  useEffect(() => {
    if (!street || !city) {
      setGeoState('idle');
      setCoords(null);
      return;
    }
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      setGeoState('searching');
      setCoords(null);
      try {
        const query = `${street}${streetNumber ? ' ' + streetNumber : ''}, ${zipCode ? zipCode + ' ' : ''}${city}, ${country}`;
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
    }, 1000);
    return () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); };
  }, [street, streetNumber, city, zipCode, country]);

  // ── Dirty check ───────────────────────────────────────────────────────────
  const isDirty =
    initial == null
      ? false
      : imageUri !== null ||
        imageUrl !== initial.imageUrl ||
        username !== initial.username ||
        aboutBusiness !== initial.aboutBusiness ||
        website !== initial.website ||
        businessType !== initial.businessType ||
        foodTypes.join(',') !== initial.foodTypes.join(',') ||
        days.join(',') !== initial.days.join(',') ||
        certifications.join(',') !== initial.certifications.join(',') ||
        contactPerson !== initial.contactPerson ||
        phoneNumber !== initial.phoneNumber ||
        (addressChanged && geoState === 'found');

  // Address can be submitted only if untouched OR if geocoded successfully
  const addressBlocksSubmit = addressChanged && geoState !== 'found';

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleItem = <T,>(list: T[], item: T, setList: (v: T[]) => void) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('errors.locationPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (addressBlocksSubmit) {
      Alert.alert(t('common.error'), t('vendor.onboarding.geocodingError'));
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('vendor.profile.editSaveConfirmTitle'),
        t('vendor.profile.editSaveConfirmMsg'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.save'), style: 'default', onPress: () => resolve(true) },
        ],
      );
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      let finalImageUrl: string | undefined;
      if (imageUri) {
        const uploaded = await uploadVendorProfileImage(imageUri);
        finalImageUrl = uploaded.imageUrl;
      }

      await updateVendorProfile({
        ...(username.trim() ? { username: username.trim() } : {}),
        ...(aboutBusiness.trim() ? { aboutBusiness: aboutBusiness.trim() } : {}),
        ...(website.trim() ? { website: website.trim() } : {}),
        ...(businessType ? { businessType } : {}),
        operatingHours: days,
        surplusFoodDetails: foodTypes,
        environmentalCertifications: certifications.join(','),
        ...(contactPerson.trim() ? { contactPerson: contactPerson.trim() } : {}),
        ...(phoneNumber.trim() ? { phone: phoneNumber.trim() } : {}),
        ...(finalImageUrl ? { imageUrl: finalImageUrl } : {}),
        // Include address only when user provided new values and geocoding succeeded
        ...(addressChanged && coords
          ? {
              address: `${street.trim()}${streetNumber.trim() ? ' ' + streetNumber.trim() : ''}, ${city.trim()}, ${country.trim()}`,
              latitude: coords.latitude,
              longitude: coords.longitude,
              zipCode: zipCode.trim(),
            }
          : {}),
      });

      await logout();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const message = (err as { message?: string })?.message;
      if (status && status >= 400 && status < 500 && message) {
        Alert.alert(t('common.error'), message);
      } else {
        Alert.alert(t('common.error'), t('errors.serverError'));
      }
      setIsSubmitting(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const email = user?.email ?? '';
  const initials = email.slice(0, 2).toUpperCase();
  const displayImage = imageUri ?? imageUrl;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Nav header ─────────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: colors.background,
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.primary.DEFAULT }}>
          {t('vendor.profile.editTitle')}
        </Text>
        <TouchableOpacity
          onPress={onSave}
          disabled={!isDirty || isSubmitting}
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
          ) : (
            <Text style={{
              fontSize: 15, fontWeight: '600',
              color: isDirty && !addressBlocksSubmit ? colors.primary.DEFAULT : colors.border,
            }}>
              {t('common.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photo ──────────────────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: colors.surface,
          alignItems: 'center', paddingVertical: 24,
          borderBottomWidth: 8, borderBottomColor: colors.background,
        }}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={{ position: 'relative' }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40, overflow: 'hidden',
              backgroundColor: colors.primary.DEFAULT,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={{ width: 80, height: 80 }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>{initials}</Text>
              )}
            </View>
            <View style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.primary.DEFAULT, borderWidth: 2, borderColor: colors.surface,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="camera-outline" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 10 }}>
            {t('vendor.onboarding.profilePhotoChange')}
          </Text>
        </View>

        {/* ── Business info ───────────────────────────────────────────────────── */}
        <SectionHeader label={t('vendor.profile.sectionBusiness')} />
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <FieldRow label={t('vendor.profile.locationName')}>
            <TextInput
              style={{ fontSize: 15, color: colors.text.primary, flex: 1 }}
              value={username}
              onChangeText={setUsername}
              placeholder={t('vendor.profile.locationName')}
              placeholderTextColor={colors.text.secondary}
              returnKeyType="next"
            />
          </FieldRow>
          <FieldRow label={t('vendor.profile.aboutBusiness')}>
            <TextInput
              style={{ fontSize: 15, color: colors.text.primary, flex: 1, minHeight: 60 }}
              value={aboutBusiness}
              onChangeText={setAboutBusiness}
              placeholder={t('vendor.offer.descPlaceholder')}
              placeholderTextColor={colors.text.secondary}
              multiline
              textAlignVertical="top"
            />
          </FieldRow>
          <FieldRow label={t('vendor.profile.website')} isLast>
            <TextInput
              style={{ fontSize: 15, color: colors.text.primary, flex: 1 }}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://"
              placeholderTextColor={colors.text.secondary}
              keyboardType="url"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </FieldRow>
        </View>

        {/* ── Business type ───────────────────────────────────────────────────── */}
        <SectionHeader label={t('vendor.profile.businessType')} />
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BUSINESS_TYPES.map((bt) => (
              <Pill
                key={bt}
                label={t(`vendor.businessTypes.${bt}`)}
                selected={businessType === bt}
                onPress={() => setBusinessType(bt)}
              />
            ))}
          </View>
        </View>

        {/* ── Food types ─────────────────────────────────────────────────────── */}
        <SectionHeader label={t('vendor.profile.surplusFood')} />
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SURPLUS_FOOD_TYPES.map((ft) => (
              <Pill
                key={ft}
                label={t(`vendor.foodTypes.${ft}`)}
                selected={foodTypes.includes(ft)}
                onPress={() => toggleItem(foodTypes, ft, setFoodTypes)}
              />
            ))}
          </View>
        </View>

        {/* ── Operating days ─────────────────────────────────────────────────── */}
        <SectionHeader label={t('vendor.profile.operatingHours')} />
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {OPERATING_DAYS.map((d) => (
              <Pill
                key={d}
                label={t(`vendor.operatingDays.${d}`)}
                selected={days.includes(d)}
                onPress={() => toggleItem(days, d, setDays)}
              />
            ))}
          </View>
        </View>

        {/* ── Certifications ─────────────────────────────────────────────────── */}
        <SectionHeader label={t('vendor.profile.certifications')} />
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CERTIFICATIONS.map((c) => (
              <Pill
                key={c}
                label={t(`vendor.certifications.${c}`)}
                selected={certifications.includes(c)}
                onPress={() => toggleItem(certifications, c, setCertifications)}
              />
            ))}
          </View>
        </View>

        {/* ── Contact ────────────────────────────────────────────────────────── */}
        <SectionHeader label={t('vendor.profile.sectionContact')} />
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <FieldRow label={t('vendor.profile.contactPerson')}>
            <TextInput
              style={{ fontSize: 15, color: colors.text.primary, flex: 1 }}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder={t('vendor.profile.contactPerson')}
              placeholderTextColor={colors.text.secondary}
              returnKeyType="next"
            />
          </FieldRow>
          <FieldRow label={t('vendor.profile.phone')} isLast>
            <TextInput
              style={{ fontSize: 15, color: colors.text.primary, flex: 1 }}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+381..."
              placeholderTextColor={colors.text.secondary}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </FieldRow>
        </View>

        {/* ── Address ────────────────────────────────────────────────────────── */}
        <SectionHeader label={t('vendor.profile.address')} />
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          {!!currentAddress && !addressChanged && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' }}>
              <Text style={{ fontSize: 12, color: colors.text.secondary, fontWeight: '500', marginBottom: 2 }}>
                {t('vendor.profile.addressCurrent')}
              </Text>
              <Text style={{ fontSize: 14, color: colors.text.primary }}>{currentAddress}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#F2F2F7' }}>
              <FieldRow label={t('auth.streetName')}>
                <TextInput
                  style={{ fontSize: 15, color: colors.text.primary }}
                  value={street}
                  onChangeText={setStreet}
                  placeholder={t('auth.streetName')}
                  placeholderTextColor={colors.text.secondary}
                  returnKeyType="next"
                />
              </FieldRow>
            </View>
            <View style={{ width: 88 }}>
              <FieldRow label={t('auth.streetNumber')}>
                <TextInput
                  style={{ fontSize: 15, color: colors.text.primary }}
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  placeholder="br."
                  placeholderTextColor={colors.text.secondary}
                  returnKeyType="next"
                />
              </FieldRow>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#F2F2F7' }}>
              <FieldRow label={t('auth.city')}>
                <TextInput
                  style={{ fontSize: 15, color: colors.text.primary }}
                  value={city}
                  onChangeText={setCity}
                  placeholder={t('auth.city')}
                  placeholderTextColor={colors.text.secondary}
                  returnKeyType="next"
                />
              </FieldRow>
            </View>
            <View style={{ width: 110 }}>
              <FieldRow label={t('auth.zipCode')}>
                <TextInput
                  style={{ fontSize: 15, color: colors.text.primary }}
                  value={zipCode}
                  onChangeText={setZipCode}
                  placeholder={t('auth.zipCode')}
                  placeholderTextColor={colors.text.secondary}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
              </FieldRow>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={{ fontSize: 12, color: colors.text.secondary, fontWeight: '500', marginBottom: 8 }}>
              {t('auth.country')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {SUPPORTED_COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCountry(c)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                    backgroundColor: country === c ? colors.primary.DEFAULT : colors.surface,
                    borderColor: country === c ? colors.primary.DEFAULT : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: country === c ? '#fff' : colors.text.secondary }}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Geocoding status — only shown when user has started typing address */}
          {geoState !== 'idle' && (
            <View style={{
              marginHorizontal: 16, marginBottom: 12,
              borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: geoState === 'found' ? colors.primary[50] ?? '#E8F5E9' : '#FFF3CD',
              borderWidth: 1.5,
              borderColor: geoState === 'found' ? colors.primary.DEFAULT : (colors.warning ?? '#FF9500'),
            }}>
              {geoState === 'searching' ? (
                <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
              ) : (
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: geoState === 'found' ? colors.primary.DEFAULT : (colors.warning ?? '#FF9500'),
                }} />
              )}
              <Text style={{
                fontSize: 13, flex: 1,
                color: geoState === 'found' ? colors.primary.DEFAULT : '#7d4e00',
              }}>
                {geoState === 'searching'
                  ? t('vendor.onboarding.geocodingSearching')
                  : geoState === 'found'
                    ? `📍 ${t('vendor.onboarding.geocodingFound')} (${coords?.latitude.toFixed(4)}, ${coords?.longitude.toFixed(4)})`
                    : t('vendor.onboarding.geocodingError')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={{
      fontSize: 12, fontWeight: '600', color: colors.text.secondary,
      textTransform: 'uppercase', letterSpacing: 0.6,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6,
    }}>
      {label}
    </Text>
  );
}

function FieldRow({
  label,
  children,
  isLast,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <View style={{
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#F2F2F7',
    }}>
      <Text style={{ fontSize: 12, color: colors.text.secondary, fontWeight: '500', marginBottom: 4 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
        backgroundColor: selected ? colors.primary.DEFAULT : colors.surface,
        borderColor: selected ? colors.primary.DEFAULT : colors.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: selected ? '#fff' : colors.text.secondary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
