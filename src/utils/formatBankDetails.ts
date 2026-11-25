/**
 * Live input formatters + validators for MoR bank fields.
 * A dinar payout needs the account holder and an 18-digit Serbian current
 * account. Display values may include dashes or a pasted IBAN; the API
 * receives 18 continuous digits.
 */

/** Absolute IBAN max (ISO 13616) when country length is unknown. */
const IBAN_MAX = 34;

/** SWIFT/BIC is exactly 8 or 11 characters. */
const SWIFT_MAX = 11;

/** NBS current-account structure: 3 bank + 13 account + 2 control. */
const ACCOUNT_DIGITS = 18;
const BANK_CODE_LENGTH = 3;
const ACCOUNT_BODY_LENGTH = 13;

/**
 * Longest string the account field must accept before formatting:
 * a grouped Serbian IBAN (`RS35 2600 0560 1001 6113 79` is 27).
 */
export const ACCOUNT_NUMBER_INPUT_MAX_LENGTH = 32;

const IBAN_FORMAT = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const SWIFT_FORMAT = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

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

/** `XXX-XXXXXXXXXXXXX-XX` for a complete 18-digit account. */
export function formatDomesticAccount(account18: string): string {
  return `${account18.slice(0, BANK_CODE_LENGTH)}-${account18.slice(BANK_CODE_LENGTH, BANK_CODE_LENGTH + ACCOUNT_BODY_LENGTH)}-${account18.slice(BANK_CODE_LENGTH + ACCOUNT_BODY_LENGTH)}`;
}

function formatDomesticDigits(digits: string): string {
  if (digits.length <= BANK_CODE_LENGTH) return digits;
  if (digits.length <= BANK_CODE_LENGTH + ACCOUNT_BODY_LENGTH) {
    return `${digits.slice(0, BANK_CODE_LENGTH)}-${digits.slice(BANK_CODE_LENGTH)}`;
  }
  return formatDomesticAccount(digits);
}

/**
 * Formats a Serbian current account while typing.
 * Digits become `XXX-XXXXXXXXXXXXX-XX` (18 digits). A complete short form
 * with leading zeros omitted in the middle (`160-380290-23`) expands to that
 * shape. A valid Serbian IBAN is replaced by the domestic account inside it.
 */
export function formatAccountNumberInput(raw: string): string {
  const compact = raw.replace(/\s+/g, '').toUpperCase();

  if (/[A-Z]/.test(compact)) {
    const iban = compact.replace(/[^A-Z0-9]/g, '');
    if (iban.startsWith('RS') && validateIban(iban).ok) {
      return formatDomesticAccount(iban.slice(4));
    }
    return formatIbanInput(iban);
  }

  const numeric = compact.replace(/[^0-9-]/g, '');
  // Third group before the middle has 13 digits: zeros in the body were omitted.
  const short = numeric.match(/^(\d{1,3})-(\d{1,12})-(\d{0,2})$/);
  if (short) {
    const bank = short[1] ?? '';
    const middle = short[2] ?? '';
    const control = short[3] ?? '';
    if (bank.length === BANK_CODE_LENGTH && control.length === 2 && middle.length >= 1) {
      const account18 = bank + middle.padStart(ACCOUNT_BODY_LENGTH, '0') + control;
      return formatDomesticAccount(account18);
    }
    const trailingDash = numeric.endsWith('-') && control.length === 0;
    return `${bank}-${middle}${control.length > 0 || trailingDash ? `-${control}` : ''}`;
  }

  const digits = numeric.replace(/\D/g, '').slice(0, ACCOUNT_DIGITS);
  return formatDomesticDigits(digits);
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
  | {
      ok: true;
      /** 18 continuous digits, ready for the payout API. */
      accountNumber: string;
    }
  | { ok: false; reason: 'empty' | 'format' | 'checksum'; accountNumber: string };

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

/**
 * Control digits for the first 16 digits of a Serbian current account.
 * NBS: ISO 7064 mod 97 — append 00, remainder mod 97, subtract from 98.
 */
export function domesticControlDigits(first16: string): string {
  let remainder = 0;
  for (const c of `${first16}00`) {
    remainder = (remainder * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return String(98 - remainder).padStart(2, '0');
}

function acceptDomestic(account18: string): AccountValidationResult {
  if (domesticControlDigits(account18.slice(0, 16)) !== account18.slice(16)) {
    return { ok: false, reason: 'checksum', accountNumber: account18 };
  }
  return { ok: true, accountNumber: account18 };
}

/**
 * Expands a domestic writing of a current account to 18 digits.
 * Accepts `160000000038029023`, `160-0000000380290-23`, and
 * `160-380290-23` (leading zeros of the 13-digit body omitted).
 */
function expandDomesticAccount(raw: string): string | null {
  const compact = raw.replace(/\s+/g, '');
  if (/^\d{18}$/.test(compact)) return compact;

  const dashed = compact.match(/^(\d{3})-(\d{1,13})-(\d{2})$/);
  if (!dashed) return null;
  const bank = dashed[1] ?? '';
  const middle = dashed[2] ?? '';
  const control = dashed[3] ?? '';
  return bank + middle.padStart(ACCOUNT_BODY_LENGTH, '0') + control;
}

/**
 * Serbian dinar current account: 18 digits and a valid NBS control number.
 * A Serbian IBAN is accepted and reduced to the 18-digit account it contains.
 */
export function validateAccountNumber(raw: string): AccountValidationResult {
  const compact = stripBankFormatting(raw);
  if (compact.length === 0) {
    return { ok: false, reason: 'empty', accountNumber: compact };
  }

  if (/[A-Z]/.test(compact)) {
    if (!compact.startsWith('RS')) {
      return { ok: false, reason: 'format', accountNumber: compact };
    }
    const ibanResult = validateIban(compact);
    if (!ibanResult.ok) {
      return {
        ok: false,
        reason: ibanResult.reason === 'checksum' ? 'checksum' : 'format',
        accountNumber: compact,
      };
    }
    return acceptDomestic(ibanResult.iban.slice(4));
  }

  const account18 = expandDomesticAccount(compact);
  if (!account18) {
    return { ok: false, reason: 'format', accountNumber: compact };
  }
  return acceptDomestic(account18);
}

/** NBS payment order: payee name is at most 3 lines of 35 characters. */
export const HOLDER_NAME_LINE_MAX = 35;
export const HOLDER_NAME_LINE_COUNT = 3;

export type HolderNameLines = [string, string, string];

export const EMPTY_HOLDER_NAME_LINES: HolderNameLines = ['', '', ''];

function asHolderLines(lines: readonly string[]): HolderNameLines {
  return [
    lines[0] ?? '',
    lines[1] ?? '',
    lines[2] ?? '',
  ];
}

/**
 * Fits text into 3 lines of 35 characters. Breaks on the last space in the
 * line when there is one, otherwise cuts at 35. `overflow` means some text
 * did not fit.
 */
export function pourHolderName(raw: string): { lines: HolderNameLines; overflow: boolean } {
  let rest = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '');

  const lines: string[] = [];
  for (let i = 0; i < HOLDER_NAME_LINE_COUNT && rest.length > 0; i += 1) {
    if (rest.length <= HOLDER_NAME_LINE_MAX) {
      lines.push(rest);
      rest = '';
      break;
    }
    const window = rest.slice(0, HOLDER_NAME_LINE_MAX);
    const breakAt = window.lastIndexOf(' ');
    const cut = breakAt > 0 ? breakAt : HOLDER_NAME_LINE_MAX;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^ +/, '');
  }

  return {
    lines: asHolderLines(lines),
    overflow: rest.length > 0,
  };
}

/** Restores the 3 entry lines from the single string stored for the account holder. */
export function splitHolderName(stored: string): { lines: HolderNameLines; overflow: boolean } {
  return pourHolderName(stored);
}

/**
 * Writes a line the vendor is typing. A paste longer than 35 characters
 * continues into the following lines.
 */
export function applyHolderLineChange(
  lines: HolderNameLines,
  index: number,
  nextRaw: string,
): { lines: HolderNameLines; overflow: boolean } {
  const cleaned = nextRaw.replace(/[\r\n]/g, '');
  if (cleaned.length <= HOLDER_NAME_LINE_MAX) {
    const next: HolderNameLines = [lines[0], lines[1], lines[2]];
    next[index] = cleaned;
    return { lines: next, overflow: false };
  }

  const poured = pourHolderName(cleaned);
  const next: HolderNameLines = [lines[0], lines[1], lines[2]];
  const room = HOLDER_NAME_LINE_COUNT - index;
  for (let i = 0; i < room; i += 1) {
    next[index + i] = poured.lines[i] ?? '';
  }
  const spilled = poured.lines.slice(room).some((line) => line.trim().length > 0);
  return { lines: next, overflow: poured.overflow || spilled };
}

/**
 * One string for storage. A line that is full (35 characters) is continued
 * immediately, so a word cut at the end of the line is not split by a space.
 * A shorter line is a finished segment and the next line follows after a space.
 */
export function joinHolderNameLines(lines: readonly string[]): string {
  const filled = lines
    .map((line) => line.replace(/[\r\n]/g, ''))
    .filter((line) => line.trim().length > 0);

  let result = '';
  for (let i = 0; i < filled.length; i += 1) {
    const current = filled[i] ?? '';
    const text = current.trim();
    if (i === 0) {
      result = text;
      continue;
    }
    const previous = filled[i - 1] ?? '';
    const continued = previous.trimEnd().length >= HOLDER_NAME_LINE_MAX;
    result += continued ? text : ` ${text}`;
  }
  return result;
}

/** Empty when line 1 is blank. Gap when a later line is filled and an earlier one is not. */
export function holderNameLineError(lines: readonly string[]): 'empty' | 'gap' | null {
  const texts = lines.map((line) => line.trim());
  if (!texts[0]) return 'empty';
  let seenEmpty = false;
  for (const text of texts) {
    if (!text) {
      seenEmpty = true;
    } else if (seenEmpty) {
      return 'gap';
    }
  }
  return null;
}

/** True once the field holds a full domestic account or a full IBAN, so a checksum error can be shown. */
export function isCompleteAccountInput(raw: string): boolean {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  if (/[A-Z]/.test(compact)) {
    return compact.replace(/[^A-Z0-9]/g, '').length >= IBAN_LENGTH_BY_COUNTRY.RS;
  }
  return compact.replace(/\D/g, '').length === ACCOUNT_DIGITS;
}
