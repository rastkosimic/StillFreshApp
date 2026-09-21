import type { Region } from 'react-native-maps';

const KM_PER_DEG_LAT = 111.32;
const EARTH_RADIUS_KM = 6371;

export const MIN_MAP_RANGE_KM = 1;
export const MAX_MAP_RANGE_KM = 200;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface ViewportSearch extends GeoPoint {
  range: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function clampMapRangeKm(km: number): number {
  return Math.min(MAX_MAP_RANGE_KM, Math.max(MIN_MAP_RANGE_KM, km));
}

/** Distance from the map centre to a corner of the visible region, in km. */
export function regionRadiusKm(region: Region): number {
  const latKm = (region.latitudeDelta / 2) * KM_PER_DEG_LAT;
  const lngKm =
    (region.longitudeDelta / 2) *
    KM_PER_DEG_LAT *
    Math.cos(toRad(region.latitude));
  return Math.sqrt(latKm * latKm + lngKm * lngKm);
}

export function regionFromRadiusKm(
  center: GeoPoint,
  radiusKm: number,
  aspectRatio: number,
): Region {
  const cos = Math.max(Math.cos(toRad(center.latitude)), 0.2);
  const aspect = aspectRatio > 0 ? aspectRatio : 1;
  const latDelta =
    (2 * radiusKm) / (KM_PER_DEG_LAT * Math.sqrt(1 + aspect * aspect * cos * cos));
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: latDelta,
    longitudeDelta: latDelta * aspect,
  };
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function viewportSearchFromRegion(region: Region): ViewportSearch {
  const padded = regionRadiusKm(region) * 1.15;
  return {
    latitude: region.latitude,
    longitude: region.longitude,
    range: Math.ceil(clampMapRangeKm(padded)),
  };
}

/** True when `lastSearch` already covers the circle needed for `needed`. */
export function isViewportCoveredBySearch(
  needed: ViewportSearch,
  lastSearch: ViewportSearch,
): boolean {
  const dist = haversineKm(needed, lastSearch);
  return dist + needed.range <= lastSearch.range * 0.9;
}
