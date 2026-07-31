import { ApiError } from '@/types';

/**
 * The chain, worker and banking endpoints return business-rule failures as HTTP 400 with a
 * user-readable `{ message }`. The message can be surfaced as-is, but several cases need
 * specific UI — an inline field error, a redirect, or hiding a control the caller should
 * never have been offered. This module turns a message into that instruction.
 */

/** Form field an inline error should be attached to. */
export type ChainErrorField =
  | 'chainName'
  | 'email'
  | 'username'
  | 'locationName'
  | 'assignedLocation'
  | 'iban'
  | 'swift'
  | 'accountNumber'
  | 'holderName'
  | 'bankName';

/** What the screen should do beyond showing a message. */
export type ChainErrorAction =
  | 'refreshProfile'
  | 'goToOnboarding'
  | 'goToProfile'
  | 'refetchLocations'
  | 'contactSupport'
  | 'hideControl'
  | 'goToPaymentSetup';

export interface MappedChainError {
  /** i18n key for the explanatory copy. */
  key: string;
  field?: ChainErrorField;
  action?: ChainErrorAction;
  /** The server's own wording — a reasonable fallback when `key` has no translation. */
  raw: string;
}

interface Rule {
  match: string;
  key: string;
  field?: ChainErrorField;
  action?: ChainErrorAction;
}

// Ordered: the first substring match wins, so put narrower phrases before broader ones.
const RULES: Rule[] = [
  // ── Chain upgrade ──
  {
    match: 'already part of a chain',
    key: 'vendor.chainErrors.alreadyChain',
    action: 'refreshProfile',
  },
  {
    match: 'finish onboarding before upgrading',
    key: 'vendor.chainErrors.onboardingIncomplete',
    action: 'goToOnboarding',
  },
  {
    match: 'chain id is missing',
    key: 'vendor.chainErrors.chainIdMissing',
    action: 'goToOnboarding',
  },
  {
    match: 'already in use',
    key: 'vendor.chainErrors.chainNameTaken',
    field: 'chainName',
  },

  // ── Locations ──
  {
    match: 'cannot update headquarters using this endpoint',
    key: 'vendor.chainErrors.hqUseProfile',
    action: 'goToProfile',
  },
  {
    match: 'cannot remove headquarters',
    key: 'vendor.chainErrors.cannotRemoveHq',
    action: 'hideControl',
  },
  {
    match: 'cannot remove your own location',
    key: 'vendor.chainErrors.cannotRemoveSelf',
    action: 'hideControl',
  },
  {
    match: 'maximum of',
    key: 'vendor.chainErrors.locationLimit',
    action: 'contactSupport',
  },
  {
    match: 'different chain',
    key: 'vendor.chainErrors.differentChain',
    action: 'refetchLocations',
  },
  {
    match: 'only headquarters can',
    key: 'vendor.chainErrors.headquartersOnly',
    action: 'hideControl',
  },

  // ── Workers ──
  {
    match: 'username already taken',
    key: 'vendor.chainErrors.usernameTaken',
    field: 'username',
  },
  {
    match: 'email already registered',
    key: 'vendor.chainErrors.emailTaken',
    field: 'email',
  },
  {
    match: 'target account is a worker',
    key: 'vendor.chainErrors.targetIsWorker',
    field: 'assignedLocation',
    action: 'refetchLocations',
  },
  {
    match: 'workers cannot own workers',
    key: 'vendor.chainErrors.targetIsWorker',
    field: 'assignedLocation',
    action: 'refetchLocations',
  },
  {
    match: 'account is not a worker',
    key: 'vendor.chainErrors.notAWorker',
    action: 'refetchLocations',
  },
  {
    match: 'worker is not assigned to a location',
    key: 'vendor.chainErrors.workerUnassigned',
    action: 'refetchLocations',
  },
  { match: 'reassign', key: 'vendor.chainErrors.reassignHqOnly', action: 'hideControl' },

  // ── Banking ──
  {
    match: 'can switch banking model',
    key: 'vendor.chainErrors.switchHqOnly',
    action: 'hideControl',
  },
  {
    match: 'must have a payment account before switching',
    key: 'vendor.chainErrors.hqNeedsAccount',
    action: 'goToPaymentSetup',
  },
  { match: 'is not part of a chain', key: 'vendor.chainErrors.notAChain' },
  { match: 'no payout account yet', key: 'vendor.chainErrors.noPayoutAccount', action: 'goToPaymentSetup' },
  {
    match: 'shared payment account',
    key: 'vendor.chainErrors.sharedBankingBankDetails',
    action: 'goToPaymentSetup',
  },
  {
    match: 'iban checksum is invalid',
    key: 'payment.ibanChecksumInvalid',
    field: 'iban',
  },
  {
    match: 'iban format is invalid',
    key: 'payment.ibanFormatInvalid',
    field: 'iban',
  },
  {
    match: 'swift/bic format is invalid',
    key: 'payment.swiftFormatInvalid',
    field: 'swift',
  },
  {
    match: 'expected 8 or 11',
    key: 'payment.swiftLengthInvalid',
    field: 'swift',
  },
  {
    match: 'account number format is invalid',
    key: 'payment.accountNumberInvalid',
    field: 'accountNumber',
  },
];

export function mapChainError(error: unknown): MappedChainError {
  const raw = extractMessage(error);
  const haystack = raw.toLowerCase();
  const rule = RULES.find((r) => haystack.includes(r.match));

  if (rule) {
    return { key: rule.key, field: rule.field, action: rule.action, raw };
  }
  return { key: 'errors.serverError', raw };
}

/**
 * A 403 from the gateway trust filter means the account was deactivated while its token was
 * still valid. Ends the session so the user lands on login with an explanation rather than a
 * screen full of failing requests. Returns true when it handled the error.
 */
export async function handleInactiveAccount(error: unknown): Promise<boolean> {
  const status = (error as ApiError | undefined)?.status;
  const message = extractMessage(error).toLowerCase();

  if (status !== 403 || !message.includes('not active')) {
    return false;
  }

  const { useAuthStore } = await import('@/stores/authStore');
  await useAuthStore.getState().logout('deactivated');
  return true;
}

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  const message = (error as ApiError | undefined)?.message;
  return typeof message === 'string' ? message : '';
}
