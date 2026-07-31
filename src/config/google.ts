import Constants from 'expo-constants';

// Google Sign-In configuration
//
// webClientId: the OAuth 2.0 Web Application client ID from Google Cloud Console.
// This is PUBLIC — safe for the client bundle. It allows the mobile app to produce a
// signed ID token that the backend verifies via POST /auth/google-login.
//
// The client_secret from the same OAuth credential belongs to the BACKEND only.
// It must never appear in this codebase.

function resolveGoogleWebClientId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (fromEnv) return fromEnv;

  const fromExtra = Constants.expoConfig?.extra?.googleWebClientId;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;

  return '';
}

export const GOOGLE_WEB_CLIENT_ID = resolveGoogleWebClientId();

if (__DEV__ && !GOOGLE_WEB_CLIENT_ID) {
  console.warn(
    '[google] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing. Set it in .env (see .env.example).',
  );
}
