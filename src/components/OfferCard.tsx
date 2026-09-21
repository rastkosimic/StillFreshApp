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

function vendorLabel(offer: Offer): string {
  return offer.chainName ?? offer.locationName ?? '';
}

function placeLabel(offer: Offer): string {
  if (offer.chainName && offer.locationName) return offer.locationName;
  return offer.address;
}

export interface OfferCardProps {
  offer: Offer;
  greyed?: boolean;
  onPress?: () => void;
  onFavoriteToggle?: (offer: Offer) => void;
  isFavorite?: boolean;
  /** Home rails stay compact; Favorites uses the full-width list layout. */
  variant?: 'rail' | 'list';
}

function QuantityBadge({ offer, greyed }: { offer: Offer; greyed: boolean }) {
  const { t } = useTranslation();
  const missedLabel = offer.soldOut ? t('customer.soldOut') : t('customer.expired');
  const quantityBadge = getQuantityLeftBadgeStyle(offer.quantityAvailable);

  return (
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
        style={{ color: greyed ? colors.text.inverse : quantityBadge.textColor }}
      >
        {greyed
          ? missedLabel
          : `${offer.quantityAvailable} ${t('customer.left')}`}
      </Text>
    </View>
  );
}

function VendorAvatar({
  uri,
  size,
  overlap,
}: {
  uri?: string;
  size: number;
  overlap?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: overlap ? -(size / 2) : 8,
        left: overlap ? 10 : 8,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: colors.surface,
        backgroundColor: colors.primary[100],
        overflow: 'hidden',
      }}
    >
      <AuthImage
        uri={uri}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="storefront-outline" size={size * 0.5} color={colors.primary[400]} />
          </View>
        }
      />
    </View>
  );
}

function FavoriteButton({
  offer,
  isFavorite,
  onFavoriteToggle,
  className,
}: {
  offer: Offer;
  isFavorite?: boolean;
  onFavoriteToggle: (offer: Offer) => void;
  className?: string;
}) {
  return (
    <TouchableOpacity
      onPress={() => onFavoriteToggle(offer)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className={className}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={18}
        color={isFavorite ? colors.favorite : colors.text.secondary}
      />
    </TouchableOpacity>
  );
}

function PriceRow({ offer, greyed }: { offer: Offer; greyed: boolean }) {
  const currency = offer.currency ?? 'RSD';

  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
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
  );
}

export default function OfferCard({
  offer,
  greyed = false,
  onPress,
  onFavoriteToggle,
  isFavorite,
  variant = 'rail',
}: OfferCardProps) {
  const pickupMeta =
    offer.pickupStartTime && offer.pickupEndTime
      ? formatPickupWindow(offer.pickupStartTime, offer.pickupEndTime)
      : null;
  const location = placeLabel(offer);
  const vendor = vendorLabel(offer);

  if (variant === 'list') {
    return (
      <TouchableOpacity
        className="bg-surface rounded-[14px] overflow-hidden w-full"
        style={{
          opacity: greyed ? 0.55 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.09,
          shadowRadius: 3,
          elevation: 2,
        }}
        onPress={greyed ? undefined : onPress}
        activeOpacity={greyed ? 1 : 0.8}
      >
        <View className="w-full h-40 bg-primary-100">
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
          <QuantityBadge offer={offer} greyed={greyed} />
          <VendorRatingBadge vendorId={offer.vendorId} size="small" />
          {onFavoriteToggle ? (
            <FavoriteButton
              offer={offer}
              isFavorite={isFavorite}
              onFavoriteToggle={onFavoriteToggle}
              className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-surface items-center justify-center"
            />
          ) : null}
          <VendorAvatar uri={offer.vendorImageUrl} size={64} overlap />
        </View>

        <View className="px-3.5 pt-10 pb-3">
          {vendor ? (
            <Text className="text-primary text-xs font-semibold" numberOfLines={1}>
              {vendor}
            </Text>
          ) : null}
          <Text className="text-text-primary text-base font-bold mt-0.5" numberOfLines={1}>
            {offer.name}
          </Text>

          {pickupMeta ? (
            <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
              <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
              <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>
                {pickupMeta}
              </Text>
            </View>
          ) : null}

          {location ? (
            <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
              <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
              <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}

          <View className="h-px bg-border mt-2.5 mb-2" />
          <PriceRow offer={offer} greyed={greyed} />
        </View>
      </TouchableOpacity>
    );
  }

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

        <QuantityBadge offer={offer} greyed={greyed} />
        <VendorRatingBadge vendorId={offer.vendorId} size="small" />

        {!greyed && onFavoriteToggle && (
          <FavoriteButton
            offer={offer}
            isFavorite={isFavorite}
            onFavoriteToggle={onFavoriteToggle}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-surface items-center justify-center"
          />
        )}

        <VendorAvatar uri={offer.vendorImageUrl} size={32} overlap />
      </View>

      <View className="px-2.5 pt-6 pb-2.5">
        {vendor ? (
          <Text className="text-primary text-xs font-semibold" numberOfLines={1}>
            {vendor}
          </Text>
        ) : null}
        <Text className="text-text-primary text-sm font-bold mt-0.5" numberOfLines={1}>
          {offer.name}
        </Text>

        {pickupMeta ? (
          <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={colors.text.secondary} />
            <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>
              {pickupMeta}
            </Text>
          </View>
        ) : null}

        {location ? (
          <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
            <Ionicons name="location-outline" size={12} color={colors.text.secondary} />
            <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        <View className="h-px bg-border mt-2 mb-1.5" />
        <PriceRow offer={offer} greyed={greyed} />
      </View>
    </TouchableOpacity>
  );
}
