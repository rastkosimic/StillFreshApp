import { createContext, useContext, useEffect } from 'react';
import * as ExpoLocation from 'expo-location';

import { useLocationStore } from '@/stores/locationStore';

interface GeolocationContextValue {
  coordinates: { latitude: number; longitude: number; accuracy?: number } | null;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  isLoading: boolean;
  requestPermission: () => Promise<boolean>;
  getLocation: () => Promise<void>;
}

const GeolocationContext = createContext<GeolocationContextValue | null>(null);

interface Props {
  children: React.ReactNode;
}

/**
 * Thin wrapper connecting Expo Location to locationStore.
 * On mount, checks existing permission and fetches location if already granted.
 */
export default function GeolocationProvider({ children }: Props) {
  const { coordinates, permissionStatus, isLoading, requestPermission, getLocation } =
    useLocationStore();

  useEffect(() => {
    const checkAndFetch = async () => {
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status === 'granted') {
        await useLocationStore.getState().getLocation();
      }
    };
    void checkAndFetch();
  }, []);

  return (
    <GeolocationContext.Provider
      value={{ coordinates, permissionStatus, isLoading, requestPermission, getLocation }}
    >
      {children}
    </GeolocationContext.Provider>
  );
}

export function useGeolocation(): GeolocationContextValue {
  const ctx = useContext(GeolocationContext);
  if (!ctx) {
    throw new Error('useGeolocation must be used within GeolocationProvider');
  }
  return ctx;
}
