import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
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
import { OnboardingStackScreenProps } from '@/navigation/types';
import { uploadVendorProfileImage } from '@/services/imageService';
import { setBankingModel, updateVendorProfile } from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { countryNameToCode, getCountryLabel, getSupportedCountries } from '@/utils/countryCodeMapper';

type Props = OnboardingStackScreenProps<'VendorProfileCompletion'>;

const SUPPORTED_COUNTRIES = getSupportedCountries();

export default function VendorProfileCompletionScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { isUniqueVendor, currentStatus } = route.params;

  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [foodTypes, setFoodTypes] = useState<SurplusFoodType[]>([]);
  const [days, setDays] = useState<OperatingDay[]>([]);
  const [certifications, setCertifications] = useState<EnvironmentalCertification[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [country, setCountry] = useState('Serbia');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step = isUniqueVendor ? 2 : 3;
  const total = isUniqueVendor ? 4 : 5;

  const canContinue =
    businessType !== null &&
    foodTypes.length > 0 &&
    (!isUniqueVendor || country.trim().length > 0);

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
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onSubmit = async () => {
    if (!businessType) return;
    setIsSubmitting(true);

    // For UNIQUE vendors: advance status TYPE_SELECTED → BANKING_SETUP
    if (isUniqueVendor && currentStatus === 'TYPE_SELECTED') {
      try {
        await setBankingModel('INDIVIDUAL', countryNameToCode(country));
      } catch (err: unknown) {
        const httpStatus = (err as { status?: number })?.status;
        if (!httpStatus || httpStatus >= 500) {
          Alert.alert(t('common.error'), t('errors.serverError'));
          setIsSubmitting(false);
          return;
        }
        // 4xx = already set — continue
      }
    }

    try {
      // Upload profile image if selected, then save the returned URL
      let imageUrl: string | undefined;
      if (imageUri) {
        const uploaded = await uploadVendorProfileImage(imageUri);
        imageUrl = uploaded.imageUrl;
      }

      await updateVendorProfile({
        businessType,
        operatingHours: days,
        surplusFoodDetails: foodTypes,
        environmentalCertifications: certifications.join(','),
        ...(imageUrl ? { imageUrl } : {}),
      });

      // UNIQUE: go straight to payment setup; CHAIN: select banking model first
      if (isUniqueVendor) {
        navigation.navigate('PaymentAccountSetup', { isUniqueVendor: true });
      } else {
        navigation.navigate('BankingModelSelection');
      }
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      if (!httpStatus || httpStatus >= 500) {
        Alert.alert(t('common.error'), t('errors.serverError'));
        setIsSubmitting(false);
        return;
      }
      // 4xx = already submitted — navigate forward anyway
      if (isUniqueVendor) {
        navigation.navigate('PaymentAccountSetup', { isUniqueVendor: true });
      } else {
        navigation.navigate('BankingModelSelection');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 py-10">
          <ProgressBar current={step} total={total} />

          <Text className="text-2xl font-bold text-text-primary mb-2 mt-6">
            {t('vendor.onboarding.profileTitle')}
          </Text>
          <Text className="text-text-secondary text-sm leading-5 mb-6">
            {t('vendor.onboarding.profileDesc')}
          </Text>

          {/* Country — UNIQUE only */}
          {isUniqueVendor && (
            <>
              <SectionLabel label={`${t('vendor.onboarding.profileCountry')} *`} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                className="mb-4"
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
                      {getCountryLabel(c, i18n.language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Business type */}
          <SectionLabel label={`${t('vendor.onboarding.profileBusinessType')} *`} />
          <View className="flex-row flex-wrap gap-2 mb-6">
            {BUSINESS_TYPES.map((bt) => (
              <Pill
                key={bt}
                label={t(`vendor.businessTypes.${bt}`)}
                selected={businessType === bt}
                onPress={() => setBusinessType(bt)}
              />
            ))}
          </View>

          {/* Food types */}
          <SectionLabel label={`${t('vendor.onboarding.profileFoodTypes')} *`} />
          <View className="flex-row flex-wrap gap-2 mb-6">
            {SURPLUS_FOOD_TYPES.map((ft) => (
              <Pill
                key={ft}
                label={t(`vendor.foodTypes.${ft}`)}
                selected={foodTypes.includes(ft)}
                onPress={() => toggleItem(foodTypes, ft, setFoodTypes)}
              />
            ))}
          </View>

          {/* Operating days */}
          <SectionLabel label={t('vendor.onboarding.profileDays')} />
          <View className="flex-row flex-wrap gap-2 mb-6">
            {OPERATING_DAYS.map((d) => (
              <Pill
                key={d}
                label={t(`vendor.operatingDays.${d}`)}
                selected={days.includes(d)}
                onPress={() => toggleItem(days, d, setDays)}
              />
            ))}
          </View>

          {/* Certifications */}
          <SectionLabel label={t('vendor.onboarding.profileCertifications')} />
          <View className="flex-row flex-wrap gap-2 mb-6">
            {CERTIFICATIONS.map((c) => (
              <Pill
                key={c}
                label={t(`vendor.certifications.${c}`)}
                selected={certifications.includes(c)}
                onPress={() => toggleItem(certifications, c, setCertifications)}
              />
            ))}
          </View>

          {/* Business photo */}
          <SectionLabel label={`${t('vendor.onboarding.profilePhoto')} *`} />
          <TouchableOpacity
            onPress={pickImage}
            activeOpacity={0.8}
            className="rounded-2xl overflow-hidden mb-2"
            style={{
              borderWidth: 2,
              borderStyle: imageUri ? 'solid' : 'dashed',
              borderColor: imageUri ? colors.primary.DEFAULT : colors.border,
              backgroundColor: imageUri ? colors.primary[50] : colors.surface,
              height: 140,
            }}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View className="flex-1 items-center justify-center gap-2">
                <Text style={{ fontSize: 32 }}>📷</Text>
                <Text className="text-text-secondary text-sm">
                  {t('vendor.onboarding.profilePhotoPrompt')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {imageUri && (
            <Text className="text-text-secondary text-xs text-center mb-6">
              {t('vendor.onboarding.profilePhotoChange')}
            </Text>
          )}

          <TouchableOpacity
            className="rounded-xl py-4 items-center mt-2"
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
            onPress={() => isUniqueVendor
              ? navigation.navigate('VendorTypeSelection')
              : navigation.navigate('HeadquartersSetup')}
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

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2">
      {label}
    </Text>
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
      className="rounded-full px-3 py-1.5 border"
      style={{
        backgroundColor: selected ? colors.primary.DEFAULT : colors.surface,
        borderColor: selected ? colors.primary.DEFAULT : colors.border,
      }}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: selected ? '#fff' : colors.text.secondary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
