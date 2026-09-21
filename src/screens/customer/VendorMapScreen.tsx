import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SimpleSlider from '@/components/SimpleSlider';
import AuthImage from '@/components/AuthImage';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';

import { CustomerStackScreenProps } from '@/navigation/types';
import { searchNearby } from '@/services/offerService';
import { useLocationStore } from '@/stores/locationStore';
import { useOffersRefreshStore } from '@/stores/offersRefreshStore';
import { colors } from '@/theme/colors';
import { Offer } from '@/types';
import { clusterMapItems, regionForCluster } from '@/utils/clusterMapItems';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatPickupWindow } from '@/utils/formatDate';
import {
  clampMapRangeKm,
  isViewportCoveredBySearch,
  MAX_MAP_RANGE_KM,
  MIN_MAP_RANGE_KM,
  regionFromRadiusKm,
  regionRadiusKm,
  viewportSearchFromRegion,
  type ViewportSearch,
} from '@/utils/mapViewport';
import { navigateToVendor } from '@/utils/navigation';

// ── Constants ─────────────────────────────────────────────────────────────────

const BELGRADE = { latitude: 44.7866, longitude: 20.4489 };
const INITIAL_DELTA = { latitudeDelta: 0.06, longitudeDelta: 0.06 };
const CLUSTER_RADIUS_PX = 52;
const AVATAR_SIZE = 44;
const MARKER_ANCHOR = { x: 0.5, y: 0.5 };
const FETCH_DEBOUNCE_MS = 400;
const RANGE_SLIDER_MARKS = [1, 20, 50, 100, 200];
const INITIAL_VISIBLE_RANGE_KM = Math.round(
  clampMapRangeKm(regionRadiusKm({ ...BELGRADE, ...INITIAL_DELTA })),
);

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
  imageUrl?: string;
}

interface VendorGroup {
  vendorId: number;
  displayName: string; // chainName ?? locationName
  address: string;
  latitude: number;
  longitude: number;
  totalBags: number;
  vendorImageUrl?: string;
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
      imageUrl: o.imageUrl,
    };

    const existing = groups.get(o.vendorId);
    if (existing) {
      existing.totalBags += o.quantityAvailable;
      if (!row.greyedOut) existing.allGreyedOut = false;
      if (!existing.vendorImageUrl && o.vendorImageUrl) {
        existing.vendorImageUrl = o.vendorImageUrl;
      }
      existing.offers.push(row);
    } else {
      groups.set(o.vendorId, {
        vendorId: o.vendorId,
        displayName: o.chainName ?? o.locationName ?? '',
        address: o.address,
        latitude: o.latitude,
        longitude: o.longitude,
        totalBags: o.quantityAvailable,
        vendorImageUrl: o.vendorImageUrl,
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

// ── ClusterPin / VendorAvatarPin ──────────────────────────────────────────────

interface ClusterPinProps {
  count: number;
  isGreyedOut: boolean;
}

function ClusterPin({ count, isGreyedOut }: ClusterPinProps) {
  const size = count >= 10 ? 52 : count >= 5 ? 48 : 44;
  const bg = isGreyedOut ? colors.text.secondary : colors.primary.DEFAULT;
  return (
    <View
      collapsable={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
      }}
    >
      <Text
        style={{
          color: colors.text.inverse,
          fontWeight: '800',
          fontSize: count >= 100 ? 13 : 16,
        }}
      >
        {count}
      </Text>
    </View>
  );
}

interface VendorAvatarPinProps {
  imageUrl?: string;
  isGreyedOut: boolean;
}

function VendorAvatarPin({ imageUrl, isGreyedOut }: VendorAvatarPinProps) {
  return (
    <View
      collapsable={false}
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        borderWidth: 3,
        borderColor: colors.surface,
        backgroundColor: colors.primary[100],
        overflow: 'hidden',
        opacity: isGreyedOut ? 0.5 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 3,
        elevation: 4,
      }}
    >
      <AuthImage
        uri={imageUrl}
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
        contentFit="cover"
        fallback={
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary[100],
            }}
          >
            <Ionicons name="storefront-outline" size={22} color={colors.primary[400]} />
          </View>
        }
      />
    </View>
  );
}

function VendorAvatarMarker({
  group,
  onPress,
}: {
  group: VendorGroup;
  onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const delay = group.vendorImageUrl ? 1500 : 80;
    const timer = setTimeout(() => setTracksViewChanges(false), delay);
    return () => clearTimeout(timer);
  }, [group.vendorImageUrl]);

  return (
    <Marker
      identifier={`vendor-${group.vendorId}`}
      coordinate={{ latitude: group.latitude, longitude: group.longitude }}
      anchor={MARKER_ANCHOR}
      tracksViewChanges={Platform.OS === 'android' ? true : tracksViewChanges}
      onPress={() => onPress()}
    >
      <VendorAvatarPin imageUrl={group.vendorImageUrl} isGreyedOut={group.allGreyedOut} />
    </Marker>
  );
}

// ── VendorPreviewCard (overlay, not a native Callout — those swallow taps) ───

interface VendorPreviewCardProps {
  group: VendorGroup;
  onNavigate: () => void;
  onOfferPress: (offerId: number) => void;
}

function VendorPreviewCard({ group, onNavigate, onOfferPress }: VendorPreviewCardProps) {
  const { t } = useTranslation();
  return (
    <View
      className="bg-surface rounded-2xl overflow-hidden border border-border"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <View className="px-4 pt-4 pb-3">
        <Text className="font-bold text-base text-text-primary" numberOfLines={1}>
          {group.displayName}
        </Text>
        <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={2}>
          {group.address}
        </Text>
      </View>

      <ScrollView
        className="px-3"
        style={{ maxHeight: 220 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="pb-3" style={{ gap: 8 }}>
          {group.offers.map((offer) => (
          <TouchableOpacity
            key={offer.id}
            activeOpacity={offer.greyedOut ? 1 : 0.85}
            disabled={offer.greyedOut}
            onPress={() => onOfferPress(offer.id)}
            className="rounded-xl overflow-hidden"
            style={{ height: 96, opacity: offer.greyedOut ? 0.5 : 1 }}
          >
            <View className="absolute inset-0 bg-primary-100">
              <AuthImage
                uri={offer.imageUrl}
                style={{ width: '100%', height: 96 }}
                contentFit="cover"
                fallback={
                  <View className="flex-1 items-center justify-center bg-primary-100">
                    <Ionicons name="bag-handle-outline" size={28} color={colors.primary[400]} />
                  </View>
                }
              />
              <View
                className="absolute inset-0"
                style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
              />
            </View>

            <View className="flex-1 justify-end px-3 py-2.5">
              <Text className="text-white font-bold text-sm" numberOfLines={1}>
                {offer.name}
              </Text>
              <View className="flex-row justify-between items-center mt-1">
                <Text className="text-white text-xs">
                  {offer.pickupStartTime && offer.pickupEndTime
                    ? formatPickupWindow(offer.pickupStartTime, offer.pickupEndTime)
                    : ''}
                </Text>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-white text-xs">
                    {offer.quantityAvailable} {t('customer.left')}
                  </Text>
                  <Text
                    className="text-sm font-extrabold"
                    style={{
                      color: offer.greyedOut ? colors.text.inverse : colors.accent.DEFAULT,
                    }}
                  >
                    {fmtPrice(offer.price, offer.currency)}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View className="px-3 pb-3">
        <TouchableOpacity
          className="bg-primary rounded-xl py-3 items-center"
          onPress={onNavigate}
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">
            {t('customer.getDirections')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function VendorMapScreen({ navigation }: CustomerStackScreenProps<'VendorMap'>) {
  const { t } = useTranslation();
  const { coordinates, requestPermission, getLocation } = useLocationStore();
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationReady, setLocationReady] = useState(false);
  const [sliderValue, setSliderValue] = useState(INITIAL_VISIBLE_RANGE_KM);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [visibleRangeKm, setVisibleRangeKm] = useState(INITIAL_VISIBLE_RANGE_KM);
  const [selectedVendor, setSelectedVendor] = useState<VendorGroup | null>(null);
  const ignoreNextMapPressRef = useRef(false);
  const rangeOpenRef = useRef(false);
  rangeOpenRef.current = rangeOpen;
  const [mapSize, setMapSize] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  });
  const centre = coordinates ?? BELGRADE;
  const [clusterRegion, setClusterRegion] = useState<Region>({
    ...centre,
    ...INITIAL_DELTA,
  });
  const regionRef = useRef<Region>({ ...centre, ...INITIAL_DELTA });
  const lastSearchRef = useRef<ViewportSearch | null>(null);
  const fetchIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clusterFrameRef = useRef<number | null>(null);
  const revision = useOffersRefreshStore((state) => state.revision);
  const clearReservations = useOffersRefreshStore((state) => state.clearReservations);

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
    async (search: ViewportSearch, silent: boolean) => {
      if (!locationReady) return;

      const last = lastSearchRef.current;
      if (last && isViewportCoveredBySearch(search, last)) return;

      const requestId = ++fetchIdRef.current;
      if (!silent) setIsLoading(true);
      try {
        const { offers } = await searchNearby({
          latitude: search.latitude,
          longitude: search.longitude,
          range: search.range,
          sort: 'distance',
        });
        if (requestId !== fetchIdRef.current) return;
        lastSearchRef.current = search;
        const withCoords = offers.filter(
          (o): o is Offer & { latitude: number; longitude: number } =>
            o.latitude != null && o.longitude != null,
        );
        const groups = groupByVendor(withCoords);
        setVendorGroups(groups);
        setSelectedVendor((prev) => {
          if (!prev) return null;
          return groups.find((g) => g.vendorId === prev.vendorId) ?? null;
        });
        clearReservations();
      } catch {
        // Non-fatal: user sees the map, just no pins
      } finally {
        if (requestId === fetchIdRef.current && !silent) setIsLoading(false);
      }
    },
    [locationReady, clearReservations],
  );

  const requestFetchForRegion = useCallback(
    (region: Region, immediate = false, silent?: boolean) => {
      const search = viewportSearchFromRegion(region);
      const run = () => {
        const useSilent = silent ?? (lastSearchRef.current !== null && !immediate);
        void fetchOffers(search, useSilent);
      };

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (immediate) {
        run();
        return;
      }

      debounceRef.current = setTimeout(run, FETCH_DEBOUNCE_MS);
    },
    [fetchOffers],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (clusterFrameRef.current != null) cancelAnimationFrame(clusterFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!locationReady) return;
    requestFetchForRegion(regionRef.current, true);
  }, [locationReady, requestFetchForRegion]);

  useEffect(() => {
    if (revision === 0) return;
    lastSearchRef.current = null;
    requestFetchForRegion(regionRef.current, true, true);
  }, [revision, requestFetchForRegion]);

  useEffect(() => {
    if (coordinates && mapRef.current) {
      const next: Region = { ...coordinates, ...INITIAL_DELTA };
      regionRef.current = next;
      setClusterRegion(next);
      mapRef.current.animateToRegion(next, 600);
    }
  }, [coordinates]);

  const handleNavigate = useCallback((group: VendorGroup) => {
    void navigateToVendor(group.latitude, group.longitude, group.displayName);
  }, []);

  const selectVendor = useCallback((group: VendorGroup) => {
    ignoreNextMapPressRef.current = true;
    setRangeOpen(false);
    setSelectedVendor(group);
  }, []);

  const handleMapPress = useCallback(() => {
    if (ignoreNextMapPressRef.current) {
      ignoreNextMapPressRef.current = false;
      return;
    }
    setSelectedVendor(null);
  }, []);

  const syncVisibleRange = useCallback((region: Region) => {
    const km = Math.round(clampMapRangeKm(regionRadiusKm(region)));
    setVisibleRangeKm(km);
    if (!rangeOpenRef.current) {
      setSliderValue((prev) => (prev === km ? prev : km));
    }
  }, []);

  const updateClusterRegion = useCallback((next: Region, force = false) => {
    setClusterRegion((prev) => {
      if (force) return next;
      if (prev.latitudeDelta <= 0 || prev.longitudeDelta <= 0) return next;
      const latZoom =
        Math.abs(prev.latitudeDelta - next.latitudeDelta) / prev.latitudeDelta;
      const lngZoom =
        Math.abs(prev.longitudeDelta - next.longitudeDelta) / prev.longitudeDelta;
      if (latZoom < 0.008 && lngZoom < 0.008) return prev;
      return next;
    });
  }, []);

  const handleRegionChange = useCallback((next: Region) => {
    regionRef.current = next;
    if (clusterFrameRef.current != null) return;
    clusterFrameRef.current = requestAnimationFrame(() => {
      clusterFrameRef.current = null;
      updateClusterRegion(regionRef.current);
    });
  }, [updateClusterRegion]);

  const handleRegionChangeComplete = useCallback((next: Region) => {
    regionRef.current = next;
    syncVisibleRange(next);
    requestFetchForRegion(next);
    updateClusterRegion(next, true);
  }, [requestFetchForRegion, syncVisibleRange, updateClusterRegion]);

  const clusteredMarkers = useMemo(
    () =>
      clusterMapItems(
        vendorGroups,
        clusterRegion,
        mapSize,
        CLUSTER_RADIUS_PX,
        (group) => group.vendorId,
      ),
    [vendorGroups, clusterRegion, mapSize],
  );

  const handleClusterPress = useCallback((items: VendorGroup[]) => {
    ignoreNextMapPressRef.current = true;
    setSelectedVendor(null);
    const next = regionForCluster(items, regionRef.current);
    regionRef.current = next;
    setClusterRegion(next);
    mapRef.current?.animateToRegion(next, 350);
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
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        onPress={handleMapPress}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setMapSize((prev) =>
              prev.width === width && prev.height === height ? prev : { width, height },
            );
          }
        }}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {clusteredMarkers.map((marker) => {
          if (marker.type === 'cluster') {
            const count = marker.items.reduce((sum, group) => sum + group.totalBags, 0);
            const isGreyedOut = marker.items.every((group) => group.allGreyedOut);
            return (
              <Marker
                key={marker.id}
                identifier={marker.id}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                anchor={MARKER_ANCHOR}
                tracksViewChanges={true}
                onPress={() => handleClusterPress(marker.items)}
              >
                <ClusterPin count={count} isGreyedOut={isGreyedOut} />
              </Marker>
            );
          }

          return (
            <VendorAvatarMarker
              key={marker.id}
              group={marker.item}
              onPress={() => selectVendor(marker.item)}
            />
          );
        })}
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
              {rangeOpen ? Math.round(sliderValue) : visibleRangeKm} km
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
              min={MIN_MAP_RANGE_KM}
              max={MAX_MAP_RANGE_KM}
              step={1}
              onValueChange={(v) => setSliderValue(v)}
              onSlidingComplete={(v) => {
                const km = clampMapRangeKm(v);
                setSliderValue(km);
                setVisibleRangeKm(Math.round(km));
                setRangeOpen(false);
                const aspect = mapSize.width > 0 && mapSize.height > 0
                  ? mapSize.width / mapSize.height
                  : 1;
                const next = regionFromRadiusKm(regionRef.current, km, aspect);
                regionRef.current = next;
                setClusterRegion(next);
                mapRef.current?.animateToRegion(next, 400);
              }}
              thumbColor={colors.primary.DEFAULT}
              minimumTrackColor={colors.primary.DEFAULT}
              maximumTrackColor={colors.border}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              {RANGE_SLIDER_MARKS.map((mark) => (
                <Text key={mark} style={{ fontSize: 10, color: colors.text.secondary }}>
                  {mark} km
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {selectedVendor && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, 12) + 8,
          }}
        >
          <VendorPreviewCard
            group={selectedVendor}
            onNavigate={() => handleNavigate(selectedVendor)}
            onOfferPress={(offerId) => navigation.navigate('OfferDetails', { offerId })}
          />
        </View>
      )}

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
          <Text style={{ color: colors.text.primary, fontSize: 13 }}>
            {t('customer.findingOffers')}
          </Text>
        </View>
      )}

      {!isLoading && vendorGroups.length === 0 && !selectedVendor && (
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
            {t('customer.noOffersNearby')}
          </Text>
        </View>
      )}
    </View>
  );
}
