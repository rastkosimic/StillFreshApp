import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import AuthImage from '@/components/AuthImage';
import VendorRatingBadge from '@/components/VendorRatingBadge';
import { colors } from '@/theme/colors';
import { Offer } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatPickupWindow } from '@/utils/formatDate';
import { getQuantityLeftBadgeStyle } from '@/utils/getQuantityLeftBadgeStyle';

function fmtPrice(amount: number, currency: string): string {
  return formatCurrency(Math.round(amount * 100), currency);
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export interface OfferCardProps {
  offer: Offer;
  greyed?: boolean;
  onPress?: () => void;
  onFavoriteToggle?: (offer: Offer) => void;
  isFavorite?: boolean;
}

export default function OfferCard({ offer, greyed = false, onPress, onFavoriteToggle, isFavorite }: OfferCardProps) {
  const { t } = useTranslation();
  const currency = offer.currency ?? 'RSD';

  const pickupMeta =
    offer.pickupStartTime && offer.pickupEndTime
      ? formatPickupWindow(offer.pickupStartTime, offer.pickupEndTime)
      : null;
  const distanceMeta = offer.distance != null ? formatDistance(offer.distance) : null;
  const meta = [pickupMeta, distanceMeta].filter(Boolean).join(' · ');

  const missedLabel = offer.soldOut ? t('customer.soldOut') : t('customer.expired');
  const quantityBadge = getQuantityLeftBadgeStyle(offer.quantityAvailable);

  return (
    <TouchableOpacity
      className="bg-surface rounded-[14px] overflow-hidden"
      style={{
        width: 175,
        opacity: greyed ? 0.5 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.09,
        shadowRadius: 3,
        elevation: 2,
      }}
      onPress={greyed ? undefined : onPress}
      activeOpacity={greyed ? 1 : 0.8}
    >
      {/* Offer image */}
      <View className="w-full h-28 bg-primary-100">
        <AuthImage
          uri={offer.imageUrl}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          fallback={
            <View className="flex-1 items-center justify-center">
              <Ionicons name="bag-handle-outline" size={36} color={colors.primary[400]} />
            </View>
          }
        />

        {/* Quantity / missed badge */}
        <View
          className="absolute top-2 left-2 rounded-full px-2 py-0.5"
          style={{
            backgroundColor: greyed
              ? colors.text.secondary
              : quantityBadge.backgroundColor,
            borderWidth: greyed ? 0 : (quantityBadge.borderWidth ?? 0),
            borderColor: greyed ? undefined : quantityBadge.borderColor,
          }}
        >
          <Text
            className="text-xs font-bold"
            style={{ color: greyed ? '#fff' : quantityBadge.textColor }}
          >
            {greyed
              ? missedLabel
              : `${offer.quantityAvailable} ${t('customer.left')}`}
          </Text>
        </View>

        {/* Rating badge */}
        <VendorRatingBadge vendorId={offer.vendorId} size="small" />

        {/* Vendor avatar — bottom-left, half-overlapping the body */}
        <View
          style={{
            position: 'absolute',
            bottom: -16,
            left: 10,
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2,
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
                <Ionicons name="storefront-outline" size={16} color={colors.primary[400]} />
              </View>
            }
          />
        </View>
      </View>

      {/* Body — pt-6 gives room for the vendor avatar that overlaps from above */}
      <View className="px-2.5 pt-6 pb-2.5">
        <Text className="text-text-secondary text-xs" numberOfLines={1}>
          {offer.chainName ?? offer.locationName ?? ''}
        </Text>
        <Text className="text-text-primary text-sm font-bold mt-0.5" numberOfLines={1}>
          {offer.name}
        </Text>
        {meta ? (
          <Text className="text-text-secondary text-xs mt-1" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}

        {/* Prices + favourite */}
        <View className="flex-row justify-between items-center mt-1.5">
          <View className="flex-row items-center" style={{ gap: 5 }}>
            {offer.originalPrice != null && (
              <Text className="text-text-secondary text-xs line-through">
                {fmtPrice(offer.originalPrice, currency)}
              </Text>
            )}
            <Text
              className={`text-base font-extrabold ${
                greyed ? 'text-text-secondary' : 'text-primary'
              }`}
            >
              {fmtPrice(offer.price, currency)}
            </Text>
          </View>

          {!greyed && onFavoriteToggle && (
            <TouchableOpacity
              onPress={() => onFavoriteToggle(offer)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? colors.favorite : colors.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
