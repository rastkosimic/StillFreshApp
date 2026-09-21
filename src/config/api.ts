// Base URL for all API requests (except notifications which use API_NOTIFICATIONS_PREFIX)
//
// In development, `localhost` only works on iOS Simulator.
// Android Emulator maps the host machine's localhost to 10.0.2.2.
// Physical devices need the host machine's LAN IP — derive it from the Expo
// dev-server hostUri so you don't have to hardcode an IP address.
function getDevBaseUrl(): string {
  try {
    // expo-constants is always present as a transitive Expo dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    // hostUri looks like "192.168.1.5:8081" or "127.0.0.1:8081"
    const hostUri: string | undefined =
      Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip the Metro port
      return `http://${host}:8080`;
    }
  } catch {
    // expo-constants unavailable (e.g. plain Node test environment)
  }
  // Fallback: works on iOS Simulator; Android Emulator needs adb reverse
  return 'http://localhost:8080';
}

// Explicit override wins in every mode (set EXPO_PUBLIC_API_URL in .env / EAS secrets).
// Fallback: local dev-server host in development, prod domain placeholder otherwise.
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = ENV_API_URL || (__DEV__ ? getDevBaseUrl() : 'https://api.stillfresh.com');

// Notification endpoints use the /api prefix per backend convention
export const API_NOTIFICATIONS_PREFIX = '/api';

// All requests time out after 30 seconds
export const API_TIMEOUT = 30_000;

export const API_ROUTES = {
  vendors: {
    ratings: {
      submit: '/vendors/ratings/submit',
      getByVendor: (vendorId: number | string) => `/vendors/ratings/vendor/${vendorId}`,
      getMyRatings: '/vendors/ratings/my-ratings',
      getSummary: (vendorId: number | string) => `/vendors/ratings/vendor/${vendorId}/summary`,
      hasRated: (orderId: number | string) => `/vendors/ratings/order/${orderId}/has-rated`,
    },
  },
} as const;
