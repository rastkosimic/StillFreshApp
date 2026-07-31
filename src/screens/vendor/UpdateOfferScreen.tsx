import { Feather } from '@expo/vector-icons';
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

import BackButton from '@/components/BackButton';
import { VendorStackScreenProps } from '@/navigation/types';
import { OFFER_CATEGORIES } from '@/config/categories';
import { uploadImage } from '@/services/imageService';
import { updateOffer } from '@/services/vendorService';
import { colors } from '@/theme/colors';
import { OfferCategory } from '@/types';

type Props = VendorStackScreenProps<'UpdateOffer'>;

function todayString(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function tomorrowString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function apiDateToUi(yyyymmdd: string): string {
  const parts = yyyymmdd.split('-');
  if (parts.length !== 3) return yyyymmdd;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function uiDateToApi(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split('-');
  if (parts.length !== 3) return ddmmyyyy;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function apiTimeToUi(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}

function uiTimeToApi(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm;
}

const TIME_PRESETS: [string, string][] = [
  ['10:00', '12:00'],
  ['12:00', '14:00'],
  ['14:00', '16:00'],
  ['16:00', '18:00'],
  ['18:00', '20:00'],
];

export default function UpdateOfferScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { offer, isReactivation } = route.params;

  const [name, setName] = useState(offer.name);
  const [description, setDescription] = useState(offer.description ?? '');
  const [price, setPrice] = useState(String(offer.price));
  const [originalPrice, setOriginalPrice] = useState(String(offer.originalPrice ?? ''));
  const [quantity, setQuantity] = useState(String(offer.quantityAvailable));
  const [pickupDate, setPickupDate] = useState(
    offer.pickupDate ? apiDateToUi(offer.pickupDate) : todayString(),
  );
  const [pickupStart, setPickupStart] = useState(
    offer.pickupStartTime ? apiTimeToUi(offer.pickupStartTime) : '',
  );
  const [pickupEnd, setPickupEnd] = useState(
    offer.pickupEndTime ? apiTimeToUi(offer.pickupEndTime) : '',
  );
  const [dietaryInfo, setDietaryInfo] = useState(offer.dietaryInfo ?? '');
  const [allergenInfo, setAllergenInfo] = useState(offer.allergenInfo ?? '');
  const [category, setCategory] = useState<OfferCategory | null>(
    (offer.category as OfferCategory) ?? null,
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const priceNum = parseFloat(price);
  const originalPriceNum = parseFloat(originalPrice);
  const priceError =
    price.length > 0 &&
    originalPrice.length > 0 &&
    !isNaN(priceNum) &&
    !isNaN(originalPriceNum) &&
    priceNum >= originalPriceNum;

  const canSubmit =
    name.trim().length > 0 &&
    price.trim().length > 0 &&
    !isNaN(priceNum) &&
    quantity.trim().length > 0 &&
    !isNaN(parseInt(quantity)) &&
    pickupDate.length === 10 &&
    pickupStart.length === 5 &&
    pickupEnd.length === 5 &&
    !priceError;

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
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      let imageUrl: string | undefined = offer.imageUrl;
      if (imageUri) {
        const res = await uploadImage(imageUri);
        imageUrl = res.imageUrl;
      }
      await updateOffer(offer.id, {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        originalPrice: originalPriceNum || undefined,
        quantityAvailable: parseInt(quantity),
        pickupDate: uiDateToApi(pickupDate),
        pickupStartTime: uiTimeToApi(pickupStart),
        pickupEndTime: uiTimeToApi(pickupEnd),
        dietaryInfo: dietaryInfo.trim() || undefined,
        allergenInfo: allergenInfo.trim() || undefined,
        category: category ?? undefined,
        imageUrl,
      });
      Alert.alert(t('common.success'), t('vendor.offerUpdated'), [
        {
          text: t('common.ok'),
          onPress: () => navigation.navigate('VendorTabs', { screen: 'VendorOffers' }),
        },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('errors.serverError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayImageUri = imageUri ?? offer.imageUrl ?? null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Nav header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 56,
          paddingBottom: 14,
          paddingHorizontal: 16,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text.primary }}>
          {isReactivation ? t('vendor.offer.reactivate') : t('vendor.updateOffer')}
        </Text>
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit || isSubmitting}
          activeOpacity={0.8}
          style={{ minWidth: 64, alignItems: 'flex-end' }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: canSubmit && !isSubmitting ? '#007AFF' : '#C7C7CC',
            }}
          >
            {t('common.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reactivation note */}
        {isReactivation && (
          <View
            style={{
              margin: 16,
              backgroundColor: '#FFF9EC',
              borderLeftWidth: 3,
              borderLeftColor: colors.warning,
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 13, color: '#7D4E00' }}>
              {t('vendor.offer.reactivationNote')}
            </Text>
          </View>
        )}

        {/* PHOTO */}
        <SectionLabel title={t('vendor.offer.image')} />
        <TouchableOpacity
          onPress={pickImage}
          activeOpacity={0.8}
          style={{
            marginHorizontal: 16,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          {displayImageUri ? (
            <View>
              <Image
                source={{ uri: displayImageUri }}
                style={{ width: '100%', height: 120 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setImageUri(null)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: 20,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontSize: 12 }}>{t('vendor.offer.imageRemove')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={{
                height: 120,
                backgroundColor: '#F2F2F7',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Feather name="camera" size={28} color="#C7C7CC" />
              <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                {t('vendor.offer.imagePlaceholder')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* BASIC INFO */}
        <SectionLabel title={t('vendor.offer.basicInfo')} />
        <FormCard>
          <InlineRow label={t('vendor.offer.fieldName')} required>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('vendor.offer.namePlaceholder')}
              placeholderTextColor="#C7C7CC"
              style={{ flex: 1, fontSize: 15, color: colors.text.primary, textAlign: 'right' }}
            />
          </InlineRow>
          <StackedRow label={t('vendor.offer.fieldDescription')} isLast>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('vendor.offer.descPlaceholder')}
              placeholderTextColor="#C7C7CC"
              style={{
                backgroundColor: '#F2F2F7',
                borderRadius: 10,
                padding: 10,
                fontSize: 14,
                color: colors.text.primary,
                minHeight: 72,
                width: '100%',
              }}
              multiline
              textAlignVertical="top"
            />
          </StackedRow>
        </FormCard>

        {/* PRICING */}
        <SectionLabel title={t('vendor.offer.pricing')} />
        <FormCard error={priceError}>
          <InlineRow label={t('vendor.offer.fieldOurPrice')} required>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder={t('vendor.offer.pricePlaceholder')}
              placeholderTextColor="#C7C7CC"
              style={{
                flex: 1,
                fontSize: 15,
                color: priceError ? colors.error : colors.text.primary,
                textAlign: 'right',
              }}
              keyboardType="decimal-pad"
            />
          </InlineRow>
          <InlineRow label={t('vendor.offer.fieldOriginalPrice')}>
            <TextInput
              value={originalPrice}
              onChangeText={setOriginalPrice}
              placeholder={t('vendor.offer.originalPricePlaceholder')}
              placeholderTextColor="#C7C7CC"
              style={{
                flex: 1,
                fontSize: 15,
                color: priceError ? colors.error : colors.text.primary,
                textAlign: 'right',
              }}
              keyboardType="decimal-pad"
            />
          </InlineRow>
          <InlineRow label={t('vendor.offer.fieldQuantity')} required isLast>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('vendor.offer.quantityPlaceholder')}
              placeholderTextColor="#C7C7CC"
              style={{ flex: 1, fontSize: 15, color: colors.text.primary, textAlign: 'right' }}
              keyboardType="number-pad"
            />
          </InlineRow>
        </FormCard>
        {priceError && (
          <Text
            style={{ fontSize: 12, color: colors.error, marginHorizontal: 18, marginTop: 4 }}
          >
            {t('vendor.offer.priceValidation')}
          </Text>
        )}

        {/* PICKUP */}
        <SectionLabel title={t('vendor.offer.pickup')} />
        <FormCard>
          {/* Date */}
          <StackedRow label={t('vendor.offer.fieldDate')} required>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            >
              <Pill
                label={t('common.today')}
                active={pickupDate === todayString()}
                onPress={() => setPickupDate(todayString())}
              />
              <Pill
                label={t('vendor.offer.tomorrow')}
                active={pickupDate === tomorrowString()}
                onPress={() => setPickupDate(tomorrowString())}
              />
            </ScrollView>
            <TextInput
              value={pickupDate}
              onChangeText={setPickupDate}
              placeholder="DD-MM-YYYY"
              placeholderTextColor="#C7C7CC"
              style={{
                backgroundColor: '#F2F2F7',
                borderRadius: 10,
                padding: 10,
                fontSize: 14,
                color: colors.text.primary,
                width: '100%',
              }}
              keyboardType="numbers-and-punctuation"
            />
          </StackedRow>

          {/* Time window */}
          <StackedRow label={t('vendor.offer.fieldTimeWindow')} required isLast>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            >
              {TIME_PRESETS.map(([start, end]) => (
                <Pill
                  key={`${start}-${end}`}
                  label={`${start}–${end}`}
                  active={pickupStart === start && pickupEnd === end}
                  onPress={() => {
                    setPickupStart(start);
                    setPickupEnd(end);
                  }}
                />
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}
                >
                  {t('vendor.offer.fieldStart')}
                </Text>
                <TextInput
                  value={pickupStart}
                  onChangeText={setPickupStart}
                  placeholder="HH:MM"
                  placeholderTextColor="#C7C7CC"
                  style={{
                    backgroundColor: '#F2F2F7',
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    color: colors.text.primary,
                  }}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}
                >
                  {t('vendor.offer.fieldEnd')}
                </Text>
                <TextInput
                  value={pickupEnd}
                  onChangeText={setPickupEnd}
                  placeholder="HH:MM"
                  placeholderTextColor="#C7C7CC"
                  style={{
                    backgroundColor: '#F2F2F7',
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    color: colors.text.primary,
                  }}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          </StackedRow>
        </FormCard>

        {/* CATEGORY & DETAILS */}
        <SectionLabel title={t('vendor.offer.category')} />
        <FormCard>
          <StackedRow label="">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Pill
                label={t('vendor.offer.noCategory')}
                active={category === null}
                onPress={() => setCategory(null)}
              />
              {OFFER_CATEGORIES.map((cat) => (
                <Pill
                  key={cat}
                  label={t(`categories.${cat}`)}
                  active={category === cat}
                  onPress={() => setCategory(cat)}
                />
              ))}
            </ScrollView>
          </StackedRow>
          <InlineRow label={t('vendor.offer.fieldDietaryInfo')}>
            <TextInput
              value={dietaryInfo}
              onChangeText={setDietaryInfo}
              placeholder={t('vendor.offer.dietaryInfoPlaceholder')}
              placeholderTextColor="#C7C7CC"
              style={{ flex: 1, fontSize: 15, color: colors.text.primary, textAlign: 'right' }}
            />
          </InlineRow>
          <InlineRow label={t('vendor.offer.fieldAllergens')} isLast>
            <TextInput
              value={allergenInfo}
              onChangeText={setAllergenInfo}
              placeholder={t('vendor.offer.allergenInfoPlaceholder')}
              placeholderTextColor="#C7C7CC"
              style={{ flex: 1, fontSize: 15, color: colors.text.primary, textAlign: 'right' }}
            />
          </InlineRow>
        </FormCard>

        {/* Submit */}
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit || isSubmitting}
          activeOpacity={0.8}
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: 'center',
            backgroundColor: canSubmit ? colors.primary.DEFAULT : '#E5E5EA',
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color={canSubmit ? '#fff' : colors.text.secondary} />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: canSubmit ? '#fff' : colors.text.secondary,
              }}
            >
              {isReactivation ? t('vendor.offer.reactivate') : t('vendor.updateOffer')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Shared form components ────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
        color: colors.text.secondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 16,
        marginBottom: 6,
        marginHorizontal: 16,
      }}
    >
      {title}
    </Text>
  );
}

function FormCard({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        marginHorizontal: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
        ...(error
          ? { borderWidth: 1.5, borderColor: colors.error }
          : { borderWidth: 0 }),
      }}
    >
      {children}
    </View>
  );
}

function InlineRow({
  label,
  children,
  isLast,
  required,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  required?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#F2F2F7',
      }}
    >
      <Text style={{ fontSize: 15, color: colors.text.primary, width: 120 }}>
        {label}
        {required ? (
          <Text style={{ color: colors.error }}> *</Text>
        ) : null}
      </Text>
      {children}
    </View>
  );
}

function StackedRow({
  label,
  children,
  isLast,
  required,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  required?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#F2F2F7',
      }}
    >
      {label.length > 0 && (
        <Text style={{ fontSize: 15, color: colors.text.primary, marginBottom: 10 }}>
          {label}
          {required ? (
            <Text style={{ color: colors.error }}> *</Text>
          ) : null}
        </Text>
      )}
      {children}
    </View>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: active ? colors.primary.DEFAULT : colors.border,
        backgroundColor: active ? colors.primary.DEFAULT : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: active ? '#fff' : colors.text.primary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
