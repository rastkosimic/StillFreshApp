export type VendorType = 'CHAIN' | 'UNIQUE';

export type BankingModel = 'SHARED' | 'INDIVIDUAL';

export type PayoutModel = 'CONNECT' | 'MOR';

export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export type OnboardingStatus =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'TYPE_SELECTED'
  | 'HEADQUARTERS_ADDED'
  | 'BANKING_SETUP'
  | 'PAYMENT_CONFIGURED'
  | 'COMPLETED';

export interface OnboardingStatusResponse {
  status: OnboardingStatus;
  isChainLocation: boolean;
  isUniqueVendor: boolean;
  chainName: string;
  isHeadquarters: boolean;
  usesSharedPaymentAccount: boolean;
}

/** Generic `{ success, message }` envelope returned by chain/worker/banking mutations. */
export interface ApiSuccessResponse {
  success: boolean;
  message: string;
}

// ── Chain locations ───────────────────────────────────────────────────────────

/**
 * A row of `GET /vendors/chain/locations`. Every location — headquarters included — is its
 * own vendor account; they are tied together by a shared `chainId`. Worker accounts live in
 * the same table but carry a non-null `assignedLocationId` and are excluded by the backend.
 */
export interface ChainLocation {
  id: number;
  locationName: string;
  email: string;
  phone?: string;
  address: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  status?: AccountStatus;
  isHeadquarters: boolean;
  onboardingStatus?: OnboardingStatus;
  payoutModel?: PayoutModel;
  usesSharedPaymentAccount?: boolean;
}

/**
 * Body for both create and update. The update endpoint is a full replacement rather than a
 * patch, so callers must always send every field — omitted ones are blanked server-side.
 * `email` is required by bean validation on update even though the update ignores it.
 */
export interface LocationRequest {
  locationName: string;
  email: string;
  phone: string;
  address: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  country?: string;
}

export interface LocationCreationResponse {
  locationId: number;
  locationName: string;
  email: string;
  emailSent: boolean;
  emailError?: string | null;
  /** Populated only when `emailSent` is false — the only copy of these credentials. */
  username?: string | null;
  password?: string | null;
  paymentAccountReady: boolean;
  message: string;
}

// ── Chain banking ─────────────────────────────────────────────────────────────

export interface ChainBankingInfo {
  bankingModel: BankingModel;
  chainName?: string;
  /** Real locations only — worker accounts are excluded from both counters. */
  totalLocations: number;
  locationsWithPaymentAccounts: number;
  headquartersHasAccount: boolean;
}

export type { VendorRatingSummary } from './rating.types';
