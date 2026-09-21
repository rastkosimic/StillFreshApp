import { Ionicons } from '@expo/vector-icons';
import { Component, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthImage from '@/components/AuthImage';
import BackButton from '@/components/BackButton';
import QuantityModal from '@/components/QuantityModal';
import RatingCategoryRow from '@/components/RatingCategoryRow';
import { CustomerStackScreenProps } from '@/navigation/types';
import {
  getAllSecurePaymentMethods,
  hasDefaultCard,
} from '@/services/allSecurePaymentService';
import { getOfferById } from '@/services/offerService';
import { getVendorRatingSummary } from '@/services/ratingService';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useOffersRefreshStore } from '@/stores/offersRefreshStore';
import { colors } from '@/theme/colors';
import { Offer, VendorRatingSummary } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatPickupWindow } from '@/utils/formatDate';
import { getQuantityLeftBadgeStyle } from '@/utils/getQuantityLeftBadgeStyle';
import { navigateToVendorWithConfirm } from '@/utils/navigation';

const HERO_HEIGHT = 280;
const VENDOR_LOGO_SIZE = 57; // 52px + 10%
const HERO_VENDOR_BOTTOM = 14;

class MapErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function fmtPrice(amount: number, currency: string): string {
  return formatCurrency(Math.round(amount * 100), currency);
}

type Props = CustomerStackScreenProps<'OfferDetails'>;

export default function OfferDetailsScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [allergensOpen, setAllergensOpen] = useState(false);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<VendorRatingSummary | null>(null);

  const { favoriteIds, toggleFavorite } = useFavoritesStore();
  const revision = useOffersRefreshStore((state) => state.revision);
  const isFavorite = offer != null && favoriteIds.has(offer.id);

  const loadOffer = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getOfferById(offerId);
      setOffer(data);
    } catch {
      // Keep existing offer on background refresh failure.
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    void loadOffer();
  }, [loadOffer]);

  useEffect(() => {
    if (revision === 0) return;
    void loadOffer(true);
  }, [revision, loadOffer]);

  useEffect(() => {
    if (offer?.vendorId == null) {
      setRatingSummary(null);
      return;
    }

    let cancelled = false;
    const loadRatingSummary = async () => {
      try {
        const summary = await getVendorRatingSummary(offer.vendorId);
        if (!cancelled) {
          setRatingSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setRatingSummary(null);
        }
      }
    };

    void loadRatingSummary();
    return () => {
      cancelled = true;
    };
  }, [offer?.vendorId]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setHeaderVisible(e.nativeEvent.contentOffset.y > HERO_HEIGHT - 60);
    },
    [],
  );

  const isUnavailable =
    offer != null && (offer.soldOut === true || offer.expired === true || offer.greyedOut === true);

  const handleReservePress = useCallback(async () => {
    if (!offer || isUnavailable) return;

    setIsCheckingPayment(true);
    try {
      const methods = await getAllSecurePaymentMethods();
      if (!hasDefaultCard(methods)) {
        Alert.alert(t('customer.noPaymentMethods'), t('customer.addCardToReserve'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('customer.addCard'),
            onPress: () => navigation.navigate('PaymentMethods'),
          },
        ]);
        return;
      }
      setQuantityModalVisible(true);
    } catch {
      Alert.alert(t('common.error'), t('errors.serverError'));
    } finally {
      setIsCheckingPayment(false);
    }
  }, [offer, isUnavailable, navigation, t]);

  const handleQuantityConfirm = useCallback(
    (quantity: number) => {
      if (!offer) return;
      setQuantityModalVisible(false);
      navigation.navigate('OrderPending', { offerId: offer.id, quantity });
    },
    [offer, navigation],
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, paddingTop: insets.top }}>
        <Text style={{ color: colors.text.secondary, marginBottom: 16 }}>{t('errors.notFound')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary.DEFAULT, fontWeight: '600' }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currency = offer.currency ?? 'RSD';
  const vendorName = offer.chainName ?? offer.locationName ?? '';
  const subLabel =
    offer.chainName != null && offer.locationName != null && offer.locationName !== offer.chainName
      ? offer.locationName
      : null;

  const pickupWindow =
    offer.pickupStartTime && offer.pickupEndTime
      ? formatPickupWindow(offer.pickupStartTime, offer.pickupEndTime)
      : null;

  const dayPillLabel = offer.collectNow
    ? t('customer.collectNow')
    : offer.pickupDaySlot === 'TOMORROW'
    ? t('customer.collectTomorrow')
    : t('customer.collectToday');

  const dayPillColor = offer.collectNow ? colors.error : colors.primary.DEFAULT;

  const hasRatings = ratingSummary != null && ratingSummary.totalRatings > 0;
  const displayRating = hasRatings ? ratingSummary.averageRating : offer.rating ?? null;
  const reviewCount = hasRatings ? ratingSummary.totalRatings : offer.reviewsCount ?? null;
  const subRatings: Array<{ label: string; value: number }> = hasRatings
    ? [
        {
          label: t('ratings.collectionProcess'),
          value: ratingSummary.averageCollectionProcessRating,
        },
        { label: t('ratings.foodQuality'), value: ratingSummary.averageQualityRating },
        { label: t('ratings.foodVariety'), value: ratingSummary.averageVarietyRating },
        { label: t('ratings.foodQuantity'), value: ratingSummary.averageQuantityRating },
      ]
    : [];

  const hasLocation = offer.latitude != null && offer.longitude != null;
  const hasAllergenInfo = !!(offer.allergenInfo || offer.dietaryInfo);
  const quantityBadgeStyle = getQuantityLeftBadgeStyle(offer.quantityAvailable);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Scrollable content ── */}
      <ScrollView
        scrollEventThrottle={16}
        onScroll={handleScroll}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >

        {/* ── Hero + vendor strip + info card ── */}
        <View style={{ position: 'relative' }}>
          <View style={{ height: HERO_HEIGHT, backgroundColor: colors.primary[100] }}>
            <AuthImage
              uri={offer.imageUrl}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              fallback={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="bag-handle-outline" size={64} color={colors.primary[400]} />
                </View>
              }
            />

            {/* Full-cover scrim — uniform overlay for consistent look */}
            <View
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.32)',
              }}
            />

            {/* Top nav row */}
            <View
              style={{
                position: 'absolute',
                top: insets.top + 10,
                left: 16,
                right: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <BackButton variant="overlay" onPress={() => navigation.goBack()} />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.82)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="share-outline" size={20} color={colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleFavorite(offer)}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.82)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isFavorite ? colors.favorite : colors.text.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Vendor strip — document flow, sits above the white info card */}
          <View
            style={{
              marginTop: -(VENDOR_LOGO_SIZE + HERO_VENDOR_BOTTOM),
              paddingHorizontal: 16,
              paddingBottom: HERO_VENDOR_BOTTOM,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              zIndex: 10,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: VENDOR_LOGO_SIZE,
                height: VENDOR_LOGO_SIZE,
                borderRadius: VENDOR_LOGO_SIZE / 2,
                borderWidth: 3,
                borderColor: colors.surface,
                backgroundColor: colors.primary[100],
                overflow: 'hidden',
              }}
            >
              <AuthImage
                uri={offer.vendorImageUrl}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                fallback={
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="storefront-outline" size={26} color={colors.primary[400]} />
                  </View>
                }
              />
            </View>

            <View style={{ flex: 1, paddingTop: 2 }}>
              <Text
                style={{ color: 'white', fontSize: 17, fontWeight: '700', lineHeight: 22 }}
              >
                {vendorName}
              </Text>
              {subLabel != null && (
                <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 18 }}>
                  {subLabel}
                </Text>
              )}
            </View>

            <View
              style={{
                backgroundColor: quantityBadgeStyle.backgroundColor,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderWidth: quantityBadgeStyle.borderWidth ?? 0,
                borderColor: quantityBadgeStyle.borderColor,
              }}
            >
              <Text style={{ color: quantityBadgeStyle.textColor, fontSize: 13, fontWeight: '700' }}>
                {offer.quantityAvailable} {t('customer.left')}
              </Text>
            </View>
          </View>

          {/* ── Info card (starts at hero bottom; never overlaps vendor strip) ── */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              marginTop: 0,
              paddingTop: 20,
              paddingHorizontal: 20,
              zIndex: 1,
              elevation: 1,
            }}
          >
          {/* Offer name */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Ionicons
              name="bag-handle-outline"
              size={22}
              color={colors.primary.DEFAULT}
              style={{ marginTop: 3 }}
            />
            <Text
              style={{
                flex: 1, fontSize: 22, fontWeight: '800',
                color: colors.text.primary, lineHeight: 28,
              }}
            >
              {offer.name}
            </Text>
          </View>

          {/* Rating */}
          {displayRating != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
              <Ionicons name="star" size={14} color={colors.rating} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>
                {displayRating.toFixed(1)}
              </Text>
              {reviewCount != null && reviewCount > 0 && (
                <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                  {'(' + reviewCount + ')'}
                </Text>
              )}
            </View>
          )}

          {/* Pickup window + day pill */}
          {pickupWindow != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Ionicons name="time-outline" size={17} color={colors.text.secondary} />
              <Text style={{ fontSize: 14, color: colors.text.primary, fontWeight: '500' }}>
                {pickupWindow}
              </Text>
              <View
                style={{
                  backgroundColor: dayPillColor,
                  borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
                }}
              >
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                  {dayPillLabel}
                </Text>
              </View>
            </View>
          )}

          {/* Address */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: 8,
              marginTop: 10, paddingBottom: 22,
            }}
          >
            <Ionicons
              name="location-outline"
              size={17}
              color={colors.text.secondary}
              style={{ marginTop: 1 }}
            />
            <Text style={{ flex: 1, fontSize: 14, color: colors.text.secondary }}>
              {offer.address}
            </Text>
          </View>
        </View>
        </View>

        <View style={{ height: 8, backgroundColor: colors.background }} />

        {/* ── About this bag ── */}
        <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: 10 }}>
            {t('customer.aboutThisBag')}
          </Text>
          {offer.description != null && offer.description.length > 0 && (
            <>
              <Text
                style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 21 }}
                numberOfLines={descExpanded ? undefined : 3}
              >
                {offer.description}
              </Text>
              <TouchableOpacity
                onPress={() => setDescExpanded(v => !v)}
                style={{ marginTop: 6 }}
              >
                <Text style={{ fontSize: 14, color: colors.primary.DEFAULT, fontWeight: '600' }}>
                  {descExpanded ? t('customer.readLess') : t('customer.readMore')}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {offer.category != null && (
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <View
                style={{
                  backgroundColor: colors.primary[50],
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
                }}
              >
                <Text style={{ fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '600' }}>
                  {t(`categories.${offer.category}`)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Vendor ratings (full breakdown when API has ratings) ── */}
        {hasRatings && displayRating != null && (
          <>
            <View style={{ height: 8, backgroundColor: colors.background }} />
            <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: 16 }}>
                {t('ratings.vendorRatings')}
              </Text>

              {/* Big rating + stars */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <Text style={{ fontSize: 48, fontWeight: '800', color: colors.text.primary, lineHeight: 52 }}>
                  {displayRating.toFixed(1)}
                </Text>
                <View>
                  <View style={{ flexDirection: 'row', gap: 3, marginBottom: 5 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Ionicons
                        key={i}
                        name={i <= Math.round(displayRating) ? 'star' : 'star-outline'}
                        size={18}
                        color={colors.rating}
                      />
                    ))}
                  </View>
                  {reviewCount != null && reviewCount > 0 && (
                    <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                      {t('ratings.totalRatings', { count: reviewCount })}
                    </Text>
                  )}
                </View>
              </View>

              {/* Sub-rating rows */}
              {subRatings.map(({ label, value }) => (
                <View key={label} className="mb-1">
                  <RatingCategoryRow label={label} rating={Math.round(value)} disabled />
                </View>
              ))}

              {/* More info link */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8, paddingVertical: 8,
                }}
              >
                <Text style={{ fontSize: 14, color: colors.primary.DEFAULT, fontWeight: '600' }}>
                  {t('customer.moreInfoAboutStore')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary.DEFAULT} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Directions ── */}
        {hasLocation && (
          <>
            <View style={{ height: 8, backgroundColor: colors.background }} />
            <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: 8 }}>
                {t('customer.directions')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
                <Ionicons
                  name="location-outline"
                  size={17}
                  color={colors.text.secondary}
                  style={{ marginTop: 1 }}
                />
                <Text style={{ flex: 1, fontSize: 14, color: colors.text.secondary }}>
                  {offer.address}
                </Text>
              </View>
              <View
                collapsable={false}
                style={{ height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}
              >
                <MapErrorBoundary
                  fallback={
                    <View
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surface,
                        gap: 6,
                      }}
                    >
                      <Ionicons name="map-outline" size={32} color={colors.text.secondary} />
                      <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                        {t('customer.mapUnavailable')}
                      </Text>
                    </View>
                  }
                >
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    initialRegion={{
                      latitude: offer.latitude!,
                      longitude: offer.longitude!,
                      latitudeDelta: 0.008,
                      longitudeDelta: 0.008,
                    }}
                  >
                    <Marker coordinate={{ latitude: offer.latitude!, longitude: offer.longitude! }} />
                  </MapView>
                </MapErrorBoundary>
              </View>
              <TouchableOpacity
                onPress={() =>
                  navigateToVendorWithConfirm(offer.latitude!, offer.longitude!, vendorName)
                }
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingVertical: 12, marginBottom: 20,
                  borderWidth: 1.5, borderColor: colors.primary.DEFAULT, borderRadius: 8,
                }}
              >
                <Ionicons name="navigate-outline" size={18} color={colors.primary.DEFAULT} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary.DEFAULT }}>
                  {t('customer.getDirections')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 8, backgroundColor: colors.background }} />

        {/* ── Collection instructions ── */}
        <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: 14 }}>
            {t('customer.collectionInstructions')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: colors.primary[50],
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="phone-portrait-outline" size={22} color={colors.primary.DEFAULT} />
            </View>
            <Text
              style={{
                flex: 1, fontSize: 14, color: colors.text.secondary,
                lineHeight: 21, marginTop: 2,
              }}
            >
              {t('customer.collectionInstructionsText')}
            </Text>
          </View>
        </View>

        <View style={{ height: 8, backgroundColor: colors.background }} />

        {/* ── Packaging ── */}
        <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: 14 }}>
            {t('customer.packaging')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View
              style={{
                flex: 1, borderWidth: 1, borderColor: colors.border,
                borderRadius: 12, padding: 14, alignItems: 'center', gap: 6,
              }}
            >
              <Ionicons name="cube-outline" size={28} color={colors.primary.DEFAULT} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.primary }}>
                {t('customer.packagingBox')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.primary.DEFAULT, fontWeight: '600' }}>
                {t('customer.packagingProvided')}
              </Text>
            </View>
            <View
              style={{
                flex: 1, borderWidth: 1, borderColor: colors.border,
                borderRadius: 12, padding: 14, alignItems: 'center', gap: 6,
              }}
            >
              <Ionicons name="bag-outline" size={28} color={colors.primary.DEFAULT} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.primary }}>
                {t('customer.packagingBag')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.primary.DEFAULT, fontWeight: '600' }}>
                {t('customer.packagingProvided')}
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontSize: 12, color: colors.text.secondary,
              marginTop: 12, textAlign: 'center', lineHeight: 18,
            }}
          >
            {t('customer.packagingTip')}
          </Text>
        </View>

        {/* ── Allergens accordion ── */}
        {hasAllergenInfo && (
          <>
            <View style={{ height: 8, backgroundColor: colors.background }} />
            <View style={{ backgroundColor: colors.surface }}>
              <TouchableOpacity
                onPress={() => setAllergensOpen(v => !v)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 20, paddingVertical: 18,
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary }}>
                  {t('customer.ingredientsAllergens')}
                </Text>
                <Ionicons
                  name={allergensOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
              {allergensOpen && (
                <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 14 }}>
                  {offer.dietaryInfo != null && offer.dietaryInfo.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <Ionicons
                        name="leaf-outline"
                        size={18}
                        color={colors.primary.DEFAULT}
                        style={{ marginTop: 1 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 2 }}>
                          {t('customer.dietaryInfoLabel')}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.text.primary }}>
                          {offer.dietaryInfo}
                        </Text>
                      </View>
                    </View>
                  )}
                  {offer.allergenInfo != null && offer.allergenInfo.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <Ionicons
                        name="warning-outline"
                        size={18}
                        color={colors.warning}
                        style={{ marginTop: 1 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 2 }}>
                          {t('customer.allergenInfoLabel')}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.text.primary }}>
                          {offer.allergenInfo}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Sticky header (appears after scrolling past hero) ── */}
      {headerVisible && (
        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            paddingTop: insets.top,
            backgroundColor: colors.background,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 16, paddingVertical: 10,
            }}
          >
            <BackButton onPress={() => navigation.goBack()} />
            <Text
              style={{
                flex: 1, fontSize: 16, fontWeight: '700', color: colors.primary.DEFAULT,
              }}
              numberOfLines={1}
            >
              {vendorName}
            </Text>
            <TouchableOpacity
              onPress={() => toggleFavorite(offer)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? colors.favorite : colors.text.secondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Bottom reserve bar ── */}
      <View
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: colors.surface,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 14 + insets.bottom,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        <View style={{ minWidth: 80 }}>
          {offer.originalPrice != null && (
            <Text
              style={{ fontSize: 13, color: colors.text.secondary, textDecorationLine: 'line-through' }}
            >
              {fmtPrice(offer.originalPrice, currency)}
            </Text>
          )}
          <Text
            style={{ fontSize: 22, fontWeight: '800', color: colors.primary.DEFAULT, lineHeight: 26 }}
          >
            {fmtPrice(offer.price, currency)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleReservePress}
          disabled={isUnavailable || isCheckingPayment}
          style={{
            flex: 1,
            backgroundColor: isUnavailable ? colors.border : colors.primary.DEFAULT,
            borderRadius: 8,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: isCheckingPayment ? 0.7 : 1,
          }}
          activeOpacity={0.85}
        >
          {isCheckingPayment ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
              {isUnavailable ? t('customer.soldOut') : t('customer.reserve')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {offer != null && (
        <QuantityModal
          visible={quantityModalVisible}
          maxQuantity={offer.quantityAvailable}
          unitPrice={offer.price}
          currency={offer.currency ?? 'RSD'}
          onClose={() => setQuantityModalVisible(false)}
          onConfirm={handleQuantityConfirm}
        />
      )}
    </View>
  );
}
