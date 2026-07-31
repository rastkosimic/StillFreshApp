// Legal documents (Privacy Policy + Terms & Conditions).
//
// The full legal text lives on the StillFresh marketing website — we never
// bundle it in the app. Screens open the hosted URLs in an in-app browser
// (Chrome Custom Tabs on Android, SFSafariViewController on iOS).
//
// Base URL resolution mirrors src/config/api.ts:
//  - Android Emulator maps the host machine to 10.0.2.2
//  - Physical devices need the host machine's LAN IP — derived from the Expo
//    dev-server hostUri so no IP has to be hardcoded
//  - Production uses the public marketing domain over HTTPS
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

import i18n from '@/localization/i18n';
import { colors } from '@/theme/colors';

// Version of the currently published legal documents ("Poslednje ažuriranje" date).
// Bump this whenever the Terms or Privacy text meaningfully changes. Sent to the
// backend on signup so it can stamp acceptance timestamps against this version.
export const LEGAL_DOCS_VERSION = '2026-07-23';

// The local marketing-web dev server runs on port 5174 (see integration prompt).
const MARKETING_DEV_PORT = 5174;

function getDevMarketingBaseUrl(): string {
  try {
    // expo-constants is always present as a transitive Expo dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const hostUri: string | undefined =
      Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip the Metro port
      return `http://${host}:${MARKETING_DEV_PORT}`;
    }
  } catch {
    // expo-constants unavailable (e.g. plain Node test environment)
  }
  // Fallback: works on iOS Simulator; Android Emulator needs 10.0.2.2
  return `http://localhost:${MARKETING_DEV_PORT}`;
}

export const MARKETING_BASE_URL = __DEV__
  ? getDevMarketingBaseUrl()
  : 'https://stillfresh.rs';

// Canonical Serbian paths (English aliases /privacy, /terms also work server-side).
export const LEGAL_URLS = {
  privacy: `${MARKETING_BASE_URL}/privatnost`,
  termsCustomer: `${MARKETING_BASE_URL}/uslovi`,
  termsVendor: `${MARKETING_BASE_URL}/uslovi-prodavci`,
} as const;

// Vendors (owners and workers) get the vendor terms; everyone else the customer terms.
export function termsUrlForRole(role: string | null | undefined): string {
  return role === 'VENDOR' || role === 'VENDOR_ADMIN'
    ? LEGAL_URLS.termsVendor
    : LEGAL_URLS.termsCustomer;
}

// Opens a legal document in an in-app browser tab. Shows a short offline hint on failure.
export async function openLegalUrl(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.surface,
      controlsColor: colors.primary.DEFAULT,
      dismissButtonStyle: 'close',
    });
  } catch {
    Alert.alert(i18n.t('common.error'), i18n.t('legal.openFailed'));
  }
}

// ── Local acceptance cache ──────────────────────────────────────────────────
// The backend is the source of truth (it stamps termsAcceptedAt / privacyAcceptedAt),
// but we also cache acceptance locally for offline display and to cover the OAuth2
// signup gap where the server does not yet persist acceptance. Non-sensitive → AsyncStorage.

const LEGAL_ACCEPTANCE_STORAGE_KEY = '@stillfresh_legal_acceptance';

export interface LocalLegalAcceptance {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string; // ISO 8601, client clock — display only, not authoritative
}

export async function recordLocalLegalAcceptance(
  version: string = LEGAL_DOCS_VERSION,
): Promise<void> {
  const record: LocalLegalAcceptance = {
    termsVersion: version,
    privacyVersion: version,
    acceptedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(LEGAL_ACCEPTANCE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Non-fatal: local cache only.
  }
}

export async function getLocalLegalAcceptance(): Promise<LocalLegalAcceptance | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGAL_ACCEPTANCE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalLegalAcceptance) : null;
  } catch {
    return null;
  }
}
