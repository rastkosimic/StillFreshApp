/**
 * Live input formatters + validators for MoR bank fields.
 * Display values may include spaces/dashes; strip before API payloads.
 */

/** Absolute IBAN max (ISO 13616) when country length is unknown. */
const IBAN_MAX = 34;

/** SWIFT/BIC is exactly 8 or 11 characters. */
const SWIFT_MAX = 11;

/** Domestic account numbers (e.g. Serbian XXX-XXXXXXXX-XX). */
const ACCOUNT_DIGITS_MAX = 13; // 3 + 8 + 2

const IBAN_FORMAT = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const SWIFT_FORMAT = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const ACCOUNT_FORMAT = /^[A-Z0-9-]{5,34}$/;

/** Fixed IBAN lengths by country (ISO 13616 national implementations). */
export const IBAN_LENGTH_BY_COUNTRY: Record<string, number> = {
  RS: 22,
  HR: 21,
  BA: 20,
  DE: 22,
  AT: 20,
  ME: 22,
};

/** Primary market default when the user has not typed a country prefix yet. */
export const DEFAULT_IBAN_COUNTRY = 'RS';

export function getIbanCountryCode(raw: string): string | null {
  const cleaned = stripBankFormatting(raw);
  if (cleaned.length < 2) return null;
  return cleaned.slice(0, 2);
}

/** Raw (no spaces) max length for the IBAN being typed. */
export function getIbanRawMaxLength(raw: string): number {
  const country = getIbanCountryCode(raw) ?? DEFAULT_IBAN_COUNTRY;
  return IBAN_LENGTH_BY_COUNTRY[country] ?? IBAN_MAX;
}

/** Display max length including spaces between groups of 4. */
export function getIbanDisplayMaxLength(raw: string): number {
  const n = getIbanRawMaxLength(raw);
  return n + Math.floor(Math.max(0, n - 1) / 4);
}

/**
 * Uppercases and groups an IBAN in blocks of 4.
 * Caps length to the country-specific size once the prefix is known (RS = 22).
 */
export function formatIbanInput(raw: string): string {
  const prefix = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 2);
  const max = IBAN_LENGTH_BY_COUNTRY[prefix] ?? getIbanRawMaxLength(raw);
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, max);
  return cleaned.replace(/(.{4})/g, '$1 ').trimEnd();
}

/** Uppercases SWIFT/BIC and keeps only alphanumerics (max 11). */
export function formatSwiftInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, SWIFT_MAX);
}

/**
 * Formats a domestic account number while typing.
 * Digit-only input uses Balkan `XXX-XXXXXXXX-XX` (13 digits).
 */
export function formatAccountNumberInput(raw: string): string {
  if (/[a-zA-Z]/.test(raw)) {
    return raw.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 34);
  }

  const digits = raw.replace(/\D/g, '').slice(0, ACCOUNT_DIGITS_MAX);
  if (digits.length <= 3) return digits;
  if (digits.length <= 11) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 11)}-${digits.slice(11)}`;
}

/** Removes spaces (and normalises case) for API payloads. */
export function stripBankFormatting(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export type IbanValidationResult =
  | { ok: true; iban: string }
  | { ok: false; reason: 'empty' | 'format' | 'length' | 'checksum'; iban: string };

export type SwiftValidationResult =
  | { ok: true; swift: string }
  | { ok: false; reason: 'empty' | 'length' | 'format'; swift: string };

export type AccountValidationResult =
  | { ok: true; accountNumber: string }
  | { ok: false; reason: 'empty' | 'format'; accountNumber: string };

/**
 * ISO 13616 structural check + mod-97 checksum (same rules as vendor-service).
 */
export function validateIban(raw: string): IbanValidationResult {
  const iban = stripBankFormatting(raw);
  if (iban.length === 0) {
    return { ok: false, reason: 'empty', iban };
  }
  if (!IBAN_FORMAT.test(iban)) {
    return { ok: false, reason: 'format', iban };
  }

  const expectedLen = IBAN_LENGTH_BY_COUNTRY[iban.slice(0, 2)];
  if (expectedLen != null && iban.length !== expectedLen) {
    return { ok: false, reason: 'length', iban };
  }

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let numeric = '';
  for (const c of rearranged) {
    numeric += c >= '0' && c <= '9' ? c : String(c.charCodeAt(0) - 55);
  }

  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 1) {
    remainder = (remainder * 10 + (numeric.charCodeAt(i) - 48)) % 97;
  }

  if (remainder !== 1) {
    return { ok: false, reason: 'checksum', iban };
  }
  return { ok: true, iban };
}

export function isValidIban(raw: string): boolean {
  return validateIban(raw).ok;
}

/**
 * SWIFT/BIC must be 8 or 11 characters: 6 letters + 2 alphanumerics + optional 3-char branch.
 * Matches vendor-service SWIFT_PATTERN.
 */
export function validateSwift(raw: string): SwiftValidationResult {
  const swift = stripBankFormatting(raw);
  if (swift.length === 0) {
    return { ok: false, reason: 'empty', swift };
  }
  if (swift.length !== 8 && swift.length !== 11) {
    return { ok: false, reason: 'length', swift };
  }
  if (!SWIFT_FORMAT.test(swift)) {
    return { ok: false, reason: 'format', swift };
  }
  return { ok: true, swift };
}

/** Account number required: 5–34 of A–Z / 0–9 / hyphen (backend rule). */
export function validateAccountNumber(raw: string): AccountValidationResult {
  const accountNumber = raw.trim().toUpperCase();
  if (accountNumber.length === 0) {
    return { ok: false, reason: 'empty', accountNumber };
  }
  if (!ACCOUNT_FORMAT.test(accountNumber)) {
    return { ok: false, reason: 'format', accountNumber };
  }
  return { ok: true, accountNumber };
}
