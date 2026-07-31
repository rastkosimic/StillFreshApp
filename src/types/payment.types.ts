import { PayoutModel } from './vendor.types';

// ── AllSecure customer card-on-file ─────────────────────────────────────────

export interface AllSecureRegisterResponse {
  provider: string;
  redirectUrl: string;
  transactionId: string;
  message: string;
}

export interface AllSecurePaymentMethod {
  paymentMethodId: string;
  type: 'card';
  isDefault: boolean;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
}

export type AllSecurePaymentStatusValue =
  | 'PROCESSING'
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHORIZED'
  | 'FAILED';

export interface AllSecurePaymentStatusResponse {
  requestId: string;
  status: AllSecurePaymentStatusValue;
  redirectUrl?: string;
  offerId?: number;
  paymentIntentId?: string;
  failureReason?: string;
  message?: string;
}

// ── Legacy / generic customer payment methods ─────────────────────────────────

export interface CustomerPaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  isDefault: boolean;
  // Card fields
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  // Bank account fields
  bankName?: string;
  accountLast4?: string;
}

export interface PaymentStatus {
  payoutModel: PayoutModel;
  isReady: boolean;
  hasAccount: boolean;
  message?: string;
}

// Stripe Connect types
export interface StripeBalance {
  available: StripeBalanceAmount[];
  pending: StripeBalanceAmount[];
}

export interface StripeBalanceAmount {
  amount: number; // in cents
  currency: string;
}

export interface StripePayout {
  id: string;
  amount: number; // in cents
  currency: string;
  status: string;
  arrivalDate: string;
  description?: string;
  bankAccount?: string;
}

export interface StripeBankAccount {
  id: string;
  bankName: string;
  last4: string;
  currency: string;
  country: string;
  isDefault: boolean;
  status: string;
}

export interface StripeTransaction {
  id: string;
  amount: number; // in cents
  currency: string;
  type: string;
  status: string;
  description?: string;
  created: string;
  fee?: number; // in cents
  net?: number; // in cents
}

export interface StripeRequirement {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
}

// Merchant of Record (MoR) types
export interface MoRBalance {
  availableBalance: number; // in cents
  pendingBalance: number; // in cents
  currency: string;
}

export interface MoRTransaction {
  id: string;
  amount: number; // in cents
  currency: string;
  type: string;
  status: string;
  description?: string;
  createdAt: string;
}

export interface MoRPayout {
  id: string;
  amount: number; // in cents
  currency: string;
  status: string;
  requestedAt: string;
  processedAt?: string;
}

export type MoRPayoutMethod = 'BANK' | 'WISE' | 'OTHER';

// GET /vendors/mor/bank-details — masked response (raw account/IBAN never leave backend)
export interface MoRBankDetailsResponse {
  hasBankDetails: boolean;
  holderName?: string;
  bankName?: string;
  swiftCode?: string;
  accountNumberMasked?: string; // e.g. "************3456"
  ibanMasked?: string;          // e.g. "************************4321"
  manualPayoutMethod?: string;
}

// PUT /vendors/mor/bank-details — save request (full values required)
export interface MoRBankDetails {
  holderName: string;
  accountNumber: string; // full, unmasked
  bankName: string;
  swiftCode?: string;
  iban?: string;         // full, unmasked
  payoutMethod: MoRPayoutMethod;
}
