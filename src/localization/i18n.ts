import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import bh from './languages/bh.json';
import en from './languages/en.json';
import hr from './languages/hr.json';
import sr from './languages/sr.json';

const LANGUAGE_STORAGE_KEY = '@stillfresh_language';

i18n.use(initReactI18next).init({
  lng: 'sr', // Default language: Serbian
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    sr: { common: sr },
    en: { common: en },
    hr: { common: hr },
    bh: { common: bh },
  },
  interpolation: {
    escapeValue: false, // React already escapes
  },
  // With bundled resources there is no async loading, but v25 changed the
  // default to async. Force synchronous init so components never render with
  // raw keys on first mount.
  initImmediate: false,
});

// Restore the language the user last chose, then persist future changes.
// This runs after the synchronous init, so the app renders in Serbian immediately
// (no flash) and switches only if the user had previously selected a different locale.
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((saved) => {
    if (saved && SUPPORTED_LOCALES.includes(saved as SupportedLocale) && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  })
  .catch(() => null)
  .finally(() => {
    // Start persisting from here so that the initial default ('sr') is only
    // written when a real change happens, not on every cold start.
    i18n.on('languageChanged', (lng: string) => {
      AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng).catch(() => null);
    });
  });

export default i18n;

export type SupportedLocale = 'sr' | 'en' | 'hr' | 'bh';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['sr', 'en', 'hr', 'bh'];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  sr: 'Srpski',
  en: 'English',
  hr: 'Hrvatski',
  bh: 'Bosanski',
};
