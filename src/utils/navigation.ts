import { Alert, Linking, Platform } from 'react-native';

/**
 * Opens Google Maps app (if installed) or falls back to the browser version
 * to give the user turn-by-turn navigation to a vendor's location.
 *
 * Deep link scheme:
 *   Android/iOS app: comgooglemaps://?daddr=lat,lng
 *   Web fallback:    https://maps.google.com/?daddr=lat,lng
 */
export async function navigateToVendor(
  latitude: number,
  longitude: number,
  vendorName?: string,
): Promise<void> {
  const destination = `${latitude},${longitude}`;
  const label = vendorName ? encodeURIComponent(vendorName) : '';

  // Google Maps app deep link (works on both Android and iOS if app is installed)
  const googleMapsApp =
    Platform.OS === 'ios'
      ? `comgooglemaps://?daddr=${destination}&directionsmode=walking`
      : `google.navigation:q=${destination}`;

  // Universal web fallback — works even without the Google Maps app
  const googleMapsWeb = `https://maps.google.com/?daddr=${destination}${label ? `&q=${label}` : ''}`;

  const canOpenApp = await Linking.canOpenURL(googleMapsApp);

  if (canOpenApp) {
    await Linking.openURL(googleMapsApp);
  } else {
    // Google Maps app not installed — open in browser
    await Linking.openURL(googleMapsWeb);
  }
}

/**
 * Prompts the user to confirm before opening navigation (optional UX pattern).
 */
export function navigateToVendorWithConfirm(
  latitude: number,
  longitude: number,
  vendorName: string,
): void {
  Alert.alert(
    'Get Directions',
    `Navigate to ${vendorName}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Google Maps',
        onPress: () => navigateToVendor(latitude, longitude, vendorName),
      },
    ],
  );
}
