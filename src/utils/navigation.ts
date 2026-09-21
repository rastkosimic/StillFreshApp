import { Alert, Linking, Platform } from 'react-native';

/**
 * Opens turn-by-turn navigation to a vendor. Tries the Google Maps app first,
 * then platform geo URLs, then the Google Maps website.
 *
 * Do not gate on Linking.canOpenURL — Android 11+ package visibility often
 * makes it return false even when google.navigation: works.
 */
export async function navigateToVendor(
  latitude: number,
  longitude: number,
  vendorName?: string,
): Promise<void> {
  const destination = `${latitude},${longitude}`;
  const label = vendorName ? encodeURIComponent(vendorName) : '';
  const labelledGeo = label
    ? `geo:${destination}?q=${destination}(${label})`
    : `geo:${destination}?q=${destination}`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

  const candidates: string[] =
    Platform.OS === 'ios'
      ? [
          `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
          `maps://?daddr=${destination}&dirflg=d`,
          web,
        ]
      : [`google.navigation:q=${destination}`, labelledGeo, web];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Try the next scheme.
    }
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
        onPress: () => {
          void navigateToVendor(latitude, longitude, vendorName);
        },
      },
    ],
  );
}
