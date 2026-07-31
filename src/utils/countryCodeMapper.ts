// Maps English country keys to backend codes and localized display labels.
// The English key is the internal state value; display uses getCountryLabel().

const COUNTRY_CODE_MAP: Record<string, string> = {
  Serbia: 'SERBIA',
  Croatia: 'CROATIA',
  'Bosnia and Herzegovina': 'BOSNIA_AND_HERZEGOVINA',
  Montenegro: 'MONTENEGRO',
  Slovenia: 'SLOVENIA',
  'North Macedonia': 'NORTH_MACEDONIA',
  Albania: 'ALBANIA',
  Kosovo: 'KOSOVO',
  Germany: 'GERMANY',
  Austria: 'AUSTRIA',
  Switzerland: 'SWITZERLAND',
  'United States': 'UNITED_STATES',
  'United Kingdom': 'UNITED_KINGDOM',
};

// Localized display labels keyed by locale then English country key.
const COUNTRY_LABELS: Record<string, Record<string, string>> = {
  sr: {
    Serbia: 'Srbija',
    Croatia: 'Hrvatska',
    'Bosnia and Herzegovina': 'Bosna i Hercegovina',
    Montenegro: 'Crna Gora',
    Slovenia: 'Slovenija',
    'North Macedonia': 'Severna Makedonija',
    Albania: 'Albanija',
    Kosovo: 'Kosovo',
    Germany: 'Nemačka',
    Austria: 'Austrija',
    Switzerland: 'Švajcarska',
    'United States': 'SAD',
    'United Kingdom': 'Ujedinjeno Kraljevstvo',
  },
  hr: {
    Serbia: 'Srbija',
    Croatia: 'Hrvatska',
    'Bosnia and Herzegovina': 'Bosna i Hercegovina',
    Montenegro: 'Crna Gora',
    Slovenia: 'Slovenija',
    'North Macedonia': 'Sjeverna Makedonija',
    Albania: 'Albanija',
    Kosovo: 'Kosovo',
    Germany: 'Njemačka',
    Austria: 'Austrija',
    Switzerland: 'Švicarska',
    'United States': 'SAD',
    'United Kingdom': 'Ujedinjeno Kraljevstvo',
  },
  bh: {
    Serbia: 'Srbija',
    Croatia: 'Hrvatska',
    'Bosnia and Herzegovina': 'Bosna i Hercegovina',
    Montenegro: 'Crna Gora',
    Slovenia: 'Slovenija',
    'North Macedonia': 'Sjeverna Makedonija',
    Albania: 'Albanija',
    Kosovo: 'Kosovo',
    Germany: 'Njemačka',
    Austria: 'Austrija',
    Switzerland: 'Švicarska',
    'United States': 'SAD',
    'United Kingdom': 'Ujedinjeno Kraljevstvo',
  },
};

// ISO-2 codes, used when the backend has normalised a country down to two letters.
const ISO2_MAP: Record<string, string> = {
  RS: 'Serbia',
  HR: 'Croatia',
  BA: 'Bosnia and Herzegovina',
  ME: 'Montenegro',
  SI: 'Slovenia',
  MK: 'North Macedonia',
  AL: 'Albania',
  XK: 'Kosovo',
  DE: 'Germany',
  AT: 'Austria',
  CH: 'Switzerland',
  US: 'United States',
  GB: 'United Kingdom',
};

export function countryNameToCode(countryName: string): string {
  return COUNTRY_CODE_MAP[countryName] ?? countryName.toUpperCase().replace(/\s+/g, '_');
}

/**
 * Resolves a stored country value back to the English key used as form state. The backend
 * normalises country input, so a saved location can come back as `SERBIA`, `RS` or `Serbia`.
 * Returns null when the value matches nothing known.
 */
export function resolveCountryKey(stored: string | undefined | null): string | null {
  if (!stored) return null;
  const value = stored.trim();
  if (COUNTRY_CODE_MAP[value]) return value;

  const upper = value.toUpperCase();
  if (ISO2_MAP[upper]) return ISO2_MAP[upper];

  const byBackendCode = Object.keys(COUNTRY_CODE_MAP).find(
    (key) => COUNTRY_CODE_MAP[key] === upper,
  );
  if (byBackendCode) return byBackendCode;

  const byName = Object.keys(COUNTRY_CODE_MAP).find(
    (key) => key.toUpperCase() === upper,
  );
  return byName ?? null;
}

export function getSupportedCountries(): string[] {
  return Object.keys(COUNTRY_CODE_MAP);
}

/** Returns a localized display label for a country key; falls back to the English key. */
export function getCountryLabel(countryKey: string, locale: string): string {
  return COUNTRY_LABELS[locale]?.[countryKey] ?? countryKey;
}
