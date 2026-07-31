import * as ExpoLocation from 'expo-location';
import { create } from 'zustand';

import { DEV_LOCATION, DEV_LOCATION_ENABLED } from '@/config/devLocation';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationState {
  coordinates: Coordinates | null;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  isLoading: boolean;
  error: string | null;
}

interface LocationActions {
  requestPermission: () => Promise<boolean>;
  getLocation: () => Promise<void>;
  setCoordinates: (coords: Coordinates) => void;
}

export const useLocationStore = create<LocationState & LocationActions>((set) => ({
  coordinates: null,
  permissionStatus: 'undetermined',
  isLoading: false,
  error: null,

  requestPermission: async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    set({ permissionStatus: granted ? 'granted' : 'denied' });
    return granted;
  },

  getLocation: async () => {
    // Double guard: __DEV__ is false in EAS production builds even if flag is left on
    if (__DEV__ && DEV_LOCATION_ENABLED) {
      set({ coordinates: DEV_LOCATION, permissionStatus: 'granted', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ isLoading: false, permissionStatus: 'denied' });
        return;
      }

      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });

      set({
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? undefined,
        },
        permissionStatus: 'granted',
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Location unavailable',
      });
    }
  },

  setCoordinates: (coords) => set({ coordinates: coords }),
}));
