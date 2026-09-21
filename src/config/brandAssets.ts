/** Bump when replacing assets/auth-icon.png so Metro and expo-image drop the old file. */
export const BRAND_ICON_REVISION = '2026-09-19-auth';

/** In-app brand icon (login / auth screens). File: assets/auth-icon.png */
export const brandAssets = {
  icon: require('../../assets/auth-icon.png'),
  googleG: require('../../assets/google-g-logo.png'),
} as const;
