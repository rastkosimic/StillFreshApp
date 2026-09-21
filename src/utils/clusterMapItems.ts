import type { Region } from 'react-native-maps';

export interface Clusterable {
  latitude: number;
  longitude: number;
}

export type MapCluster<T extends Clusterable> =
  | {
      type: 'cluster';
      id: string;
      latitude: number;
      longitude: number;
      items: T[];
    }
  | {
      type: 'point';
      id: string;
      latitude: number;
      longitude: number;
      item: T;
    };

export interface ClusterMapSize {
  width: number;
  height: number;
}

/**
 * Groups items whose screen positions overlap at the current zoom.
 * Pixel distance is invariant under pan, so only latitude/longitude deltas matter.
 */
export function clusterMapItems<T extends Clusterable>(
  items: T[],
  region: Pick<Region, 'latitudeDelta' | 'longitudeDelta'>,
  mapSize: ClusterMapSize,
  radiusPx: number,
  getId: (item: T) => string | number,
): MapCluster<T>[] {
  if (items.length === 0) return [];

  const latDelta = region.latitudeDelta;
  const lngDelta = region.longitudeDelta;
  if (latDelta <= 0 || lngDelta <= 0 || mapSize.width <= 0 || mapSize.height <= 0) {
    return items.map((item) => ({
      type: 'point' as const,
      id: String(getId(item)),
      latitude: item.latitude,
      longitude: item.longitude,
      item,
    }));
  }

  const radiusSq = radiusPx * radiusPx;
  const projected = items.map((item, index) => ({
    index,
    item,
    x: (item.longitude / lngDelta) * mapSize.width,
    y: (item.latitude / latDelta) * mapSize.height,
  }));

  const visited = new Set<number>();
  const result: MapCluster<T>[] = [];

  for (const seed of projected) {
    if (visited.has(seed.index)) continue;

    const members = [seed];
    visited.add(seed.index);

    for (const other of projected) {
      if (visited.has(other.index)) continue;
      const dx = seed.x - other.x;
      const dy = seed.y - other.y;
      if (dx * dx + dy * dy <= radiusSq) {
        members.push(other);
        visited.add(other.index);
      }
    }

    if (members.length === 1) {
      result.push({
        type: 'point',
        id: `vendor-${getId(seed.item)}`,
        latitude: seed.item.latitude,
        longitude: seed.item.longitude,
        item: seed.item,
      });
      continue;
    }

    const ids = members
      .map((m) => String(getId(m.item)))
      .sort()
      .join('-');
    result.push({
      type: 'cluster',
      id: `cluster-${ids}`,
      latitude: members.reduce((sum, m) => sum + m.item.latitude, 0) / members.length,
      longitude: members.reduce((sum, m) => sum + m.item.longitude, 0) / members.length,
      items: members.map((m) => m.item),
    });
  }

  return result;
}

export function regionForCluster<T extends Clusterable>(
  items: T[],
  current: Region,
): Region {
  const lats = items.map((item) => item.latitude);
  const lngs = items.map((item) => item.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.2, current.latitudeDelta / 3.5, 0.002),
    longitudeDelta: Math.max((maxLng - minLng) * 2.2, current.longitudeDelta / 3.5, 0.002),
  };
}
