import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SimpleSlider from '@/components/SimpleSlider';
import MapView, {
  Callout,
  Marker,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';

import { searchNearby } from '@/services/offerService';
import { useLocationStore } from '@/stores/locationStore';
import { useOffersRefreshStore } from '@/stores/offersRefreshStore';
import { colors } from '@/theme/colors';
import { Offer } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatPickupWindow } from '@/utils/formatDate';
import { navigateToVendor } from '@/utils/navigation';

// ── Constants ─────────────────────────────────────────────────────────────────

const BELGRADE = { latitude: 44.7866, longitude: 20.4489 };
const INITIAL_DELTA = { latitudeDelta: 0.06, longitudeDelta: 0.06 };

// ── Types ─────────────────────────────────────────────────────────────────────

interface OfferRow {
  id: number;
  name: string;
  price: number;
  currency: string;
  quantityAvailable: number;
  pickupStartTime?: string;
  pickupEndTime?: string;
  greyedOut: boolean;
}

interface VendorGroup {
  vendorId: number;
  displayName: string; // chainName ?? locationName
  address: string;
  latitude: number;
  longitude: number;
  totalBags: number;
  offers: OfferRow[];
  allGreyedOut: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByVendor(
  offers: Array<Offer & { latitude: number; longitude: number }>,
): VendorGroup[] {
  const groups = new Map<number, VendorGroup>();

  for (const o of offers) {
    const row: OfferRow = {
      id: o.id,
      name: o.name,
      price: o.price,
      currency: o.currency ?? 'RSD',
      quantityAvailable: o.quantityAvailable,
      pickupStartTime: o.pickupStartTime,
      pickupEndTime: o.pickupEndTime,
      greyedOut: o.greyedOut ?? false,
    };

    const existing = groups.get(o.vendorId);
    if (existing) {
      existing.totalBags += o.quantityAvailable;
      if (!row.greyedOut) existing.allGreyedOut = false;
      existing.offers.push(row);
    } else {
      groups.set(o.vendorId, {
        vendorId: o.vendorId,
        displayName: o.chainName ?? o.locationName ?? '',
        address: o.address,
        latitude: o.latitude,
        longitude: o.longitude,
        totalBags: o.quantityAvailable,
        offers: [row],
        allGreyedOut: row.greyedOut,
      });
    }
  }

  return Array.from(groups.values());
}

// API prices are floats (e.g. 4.99), formatCurrency expects cents
function fmtPrice(amount: number, currency: string): string {
  return formatCurrency(Math.round(amount * 100), currency);
}

// ── VendorPin ─────────────────────────────────────────────────────────────────

interface VendorPinProps {
  totalBags: number;
  isGreyedOut: boolean;
}

function VendorPin({ totalBags, isGreyedOut }: VendorPinProps) {
  const bg = isGreyedOut ? colors.text.secondary : colors.primary.DEFAULT;
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 20,
          minWidth: 36,
          height: 36,
          paddingHorizontal: 8,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
          elevation: 4,
          borderWidth: 2,
          borderColor: '#fff',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{totalBags}</Text>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 8,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: bg,
          marginTop: -1,
        }}
      />
    </View>
  );
}

// ── VendorCallout ─────────────────────────────────────────────────────────────

interface VendorCalloutProps {
  group: VendorGroup;
  onNavigate: () => void;
}

function VendorCallout({ group, onNavigate }: VendorCalloutProps) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        minWidth: 240,
        maxWidth: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {/* Vendor header */}
      <Text
        style={{ fontWeight: '700', fontSize: 15, color: colors.text.primary, marginBottom: 2 }}
        numberOfLines={1}
      >
        {group.displayName}
      </Text>
      <Text
        style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 10 }}
        numberOfLines={2}
      >
        {group.address}
      </Text>

      {/* One row per offer */}
      {group.offers.map((offer, idx) => (
        <View key={offer.id} style={{ opacity: offer.greyedOut ? 0.45 : 1 }}>
          {idx > 0 && (
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          )}
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: colors.text.primary, marginBottom: 3 }}
            numberOfLines={1}
          >
            {offer.name}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.text.secondary }}>
              {offer.pickupStartTime && offer.pickupEndTime
                ? formatPickupWindow(offer.pickupStartTime, offer.pickupEndTime)
                : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                {offer.quantityAvailable} bags
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: offer.greyedOut ? colors.text.secondary : colors.primary.DEFAULT,
                }}
              >
                {fmtPrice(offer.price, offer.currency)}
              </Text>
            </View>
          </View>
        </View>
      ))}

      {/* Get directions — vendor location is the same for all offers */}
      <TouchableOpacity
        style={{
          backgroundColor: colors.primary.DEFAULT,
          borderRadius: 8,
          paddingVertical: 8,
          alignItems: 'center',
          marginTop: 12,
        }}
        onPress={onNavigate}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Get Directions</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function VendorMapScreen() {
  const { t } = useTranslation();
  const { coordinates, requestPermission, getLocation } = useLocationStore();
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationReady, setLocationReady] = useState(false);
  const [range, setRange] = useState(20);
  const [sliderValue, setSliderValue] = useState(20);
  const [rangeOpen, setRangeOpen] = useState(false);
  const revision = useOffersRefreshStore((state) => state.revision);
  const clearReservations = useOffersRefreshStore((state) => state.clearReservations);

  const centre = coordinates ?? BELGRADE;

  useEffect(() => {
    const init = async () => {
      if (!coordinates) {
        const granted = await requestPermission();
        if (granted) await getLocation();
      }
      setLocationReady(true);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOffers = useCallback(
    async (silent = false) => {
      if (!locationReady) return;

      if (!silent) setIsLoading(true);
      try {
        const { offers } = await searchNearby({
          latitude: centre.latitude,
          longitude: centre.longitude,
          range,
          sort: 'distance',
        });
        const withCoords = offers.filter(
          (o): o is Offer & { latitude: number; longitude: number } =>
            o.latitude != null && o.longitude != null,
        );
        setVendorGroups(groupByVendor(withCoords));
        clearReservations();
      } catch {
        // Non-fatal: user sees the map, just no pins
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [locationReady, centre.latitude, centre.longitude, range, clearReservations],
  );

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  useEffect(() => {
    if (revision === 0) return;
    void fetchOffers(true);
  }, [revision, fetchOffers]);

  useEffect(() => {
    if (coordinates && mapRef.current) {
      mapRef.current.animateToRegion({ ...coordinates, ...INITIAL_DELTA }, 600);
    }
  }, [coordinates]);

  const handleNavigate = useCallback((group: VendorGroup) => {
    navigateToVendor(group.latitude, group.longitude, group.displayName);
  }, []);

  const initialRegion: Region = { ...centre, ...INITIAL_DELTA };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {vendorGroups.map((group) => (
          <Marker
            key={String(group.vendorId)}
            coordinate={{ latitude: group.latitude, longitude: group.longitude }}
            tracksViewChanges={false}
          >
            <VendorPin totalBags={group.totalBags} isGreyedOut={group.allGreyedOut} />
            <Callout tooltip>
              <VendorCallout group={group} onNavigate={() => handleNavigate(group)} />
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Range chip + slider panel — floats below the status bar */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          right: 16,
        }}
        pointerEvents="box-none"
      >
        {/* Chip row */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => setRangeOpen((v) => !v)}
            activeOpacity={0.8}
            pointerEvents="auto"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
              backgroundColor: rangeOpen ? colors.primary.DEFAULT : colors.surface,
              borderWidth: 1,
              borderColor: rangeOpen ? colors.primary.DEFAULT : colors.border,
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12, shadowRadius: 3, elevation: 3,
            }}
          >
            <Ionicons
              name="navigate-outline"
              size={12}
              color={rangeOpen ? '#fff' : colors.primary.DEFAULT}
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: rangeOpen ? '#fff' : colors.text.primary }}>
              {range} km
            </Text>
            <Ionicons
              name={rangeOpen ? 'chevron-up' : 'chevron-down'}
              size={10}
              color={rangeOpen ? '#fff' : colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Slider panel */}
        {rangeOpen && (
          <View
            pointerEvents="auto"
            style={{
              marginTop: 8, padding: 14,
              backgroundColor: colors.surface, borderRadius: 14,
              borderWidth: 1, borderColor: colors.border,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.secondary }}>
                {t('customer.searchRadius')}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary.DEFAULT }}>
                {Math.round(sliderValue)} km
              </Text>
            </View>

            <SimpleSlider
              value={sliderValue}
              min={1}
              max={50}
              step={1}
              onValueChange={(v) => setSliderValue(v)}
              onSlidingComplete={(v) => {
                setSliderValue(v);
                setRange(v);
                setRangeOpen(false);
              }}
              thumbColor={colors.primary.DEFAULT}
              minimumTrackColor={colors.primary.DEFAULT}
              maximumTrackColor={colors.border}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              {[1, 10, 20, 30, 50].map((mark) => (
                <Text key={mark} style={{ fontSize: 10, color: colors.text.secondary }}>
                  {mark} km
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {isLoading && (
        <View
          style={{
            position: 'absolute',
            top: 16,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
          <Text style={{ color: colors.text.primary, fontSize: 13 }}>Finding offers...</Text>
        </View>
      )}

      {!isLoading && vendorGroups.length === 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 24,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text style={{ color: colors.text.secondary, fontSize: 14 }}>
            No offers nearby right now
          </Text>
        </View>
      )}
    </View>
  );
}
