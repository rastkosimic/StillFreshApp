import { useLocationStore } from '@/stores/locationStore';

export function useLocation() {
  const { coordinates, permissionStatus, isLoading, error, requestPermission, getLocation } =
    useLocationStore();
  return { coordinates, permissionStatus, isLoading, error, requestPermission, getLocation };
}
