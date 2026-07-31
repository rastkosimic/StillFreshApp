import apiClient from './apiClient';
import {
  MoRBalance,
  MoRBankDetails,
  MoRBankDetailsResponse,
  MoRPayout,
  MoRTransaction,
  PaymentStatus,
  StripeBalance,
  StripeBankAccount,
  StripePayout,
  StripeRequirement,
  StripeTransaction,
} from '@/types';

// ── Shared ────────────────────────────────────────────────────────────────────

export async function getPaymentStatus(): Promise<PaymentStatus> {
  const response = await apiClient.get<PaymentStatus>('/vendors/payment/status');
  return response.data;
}

export async function getPaymentOnboardingLink(): Promise<{ url: string }> {
  const response = await apiClient.get<{ url: string }>('/vendors/payment/onboarding-link');
  return response.data;
}

export async function handleStripeReturn(): Promise<void> {
  await apiClient.post('/vendors/stripe/return');
}

export async function handleStripeRefresh(): Promise<void> {
  await apiClient.post('/vendors/stripe/refresh');
}

// ── Stripe Connect ────────────────────────────────────────────────────────────

export async function getStripeAccountStatus(): Promise<Record<string, unknown>> {
  const response = await apiClient.get<Record<string, unknown>>('/vendors/stripe/account/status');
  return response.data;
}

export async function getStripeOnboardingLink(): Promise<{ url: string }> {
  const response = await apiClient.get<{ url: string }>('/vendors/stripe/onboarding-link');
  return response.data;
}

export async function getStripeBalance(): Promise<StripeBalance> {
  const response = await apiClient.get<StripeBalance>('/vendors/stripe/balance');
  return response.data;
}

export async function getStripeAccount(): Promise<Record<string, unknown>> {
  const response = await apiClient.get<Record<string, unknown>>('/vendors/stripe/account');
  return response.data;
}

export async function getStripeRequirements(): Promise<StripeRequirement> {
  const response = await apiClient.get<StripeRequirement>('/vendors/stripe/requirements');
  return response.data;
}

export async function getStripeTransactions(limit = 20): Promise<StripeTransaction[]> {
  const response = await apiClient.get<StripeTransaction[]>('/vendors/stripe/transactions', {
    params: { limit },
  });
  return response.data;
}

export async function getStripePayouts(limit = 20): Promise<StripePayout[]> {
  const response = await apiClient.get<StripePayout[]>('/vendors/stripe/payouts', {
    params: { limit },
  });
  return response.data;
}

export async function getStripePayoutById(payoutId: string): Promise<StripePayout> {
  const response = await apiClient.get<StripePayout>(`/vendors/stripe/payouts/${payoutId}`);
  return response.data;
}

export async function getStripeBankAccounts(): Promise<StripeBankAccount[]> {
  const response = await apiClient.get<StripeBankAccount[]>('/vendors/stripe/bank-accounts');
  return response.data;
}

export async function setDefaultBankAccount(
  bankAccountId: string,
  currency: string,
): Promise<void> {
  await apiClient.put(`/vendors/stripe/bank-accounts/${bankAccountId}/default`, { currency });
}

export async function deleteBankAccount(bankAccountId: string): Promise<void> {
  await apiClient.delete(`/vendors/stripe/bank-accounts/${bankAccountId}`);
}

export async function getStripeLoginLink(): Promise<{ url: string }> {
  const response = await apiClient.get<{ url: string }>('/vendors/stripe/login-link');
  return response.data;
}

// ── Merchant of Record (MoR) ──────────────────────────────────────────────────

export async function getMoRBalance(): Promise<MoRBalance> {
  const response = await apiClient.get<MoRBalance>('/vendors/mor/balance');
  return response.data;
}

export async function getMoRTransactions(limit = 20): Promise<MoRTransaction[]> {
  const response = await apiClient.get<MoRTransaction[]>('/vendors/mor/transactions', {
    params: { limit },
  });
  return response.data;
}

export async function getMoRPayouts(): Promise<MoRPayout[]> {
  const response = await apiClient.get<MoRPayout[]>('/vendors/mor/payouts');
  return response.data;
}

export async function requestMoRPayout(
  amount: number,
  currency = 'RSD',
  description?: string,
): Promise<MoRPayout> {
  const response = await apiClient.post<MoRPayout>('/vendors/mor/payouts', {
    amount,
    currency,
    description,
  });
  return response.data;
}

export async function getMoRBankDetails(): Promise<MoRBankDetailsResponse> {
  const response = await apiClient.get<MoRBankDetailsResponse>('/vendors/mor/bank-details');
  return response.data;
}

export async function saveMoRBankDetails(data: MoRBankDetails): Promise<void> {
  await apiClient.put('/vendors/mor/bank-details', data);
}

/**
 * MoR bank details for a chain location (INDIVIDUAL banking).
 * HQ may use any locationId in the chain; a branch admin only its own.
 */
export async function getLocationMoRBankDetails(
  locationId: number | string,
): Promise<MoRBankDetailsResponse> {
  const response = await apiClient.get<MoRBankDetailsResponse>(
    `/vendors/chain/locations/${locationId}/mor/bank-details`,
  );
  return response.data;
}

/**
 * Writes MoR bank details onto a chain location. Same body as saveMoRBankDetails.
 * Initialises MoR on the server if needed and completes onboarding when a destination exists.
 */
export async function saveLocationMoRBankDetails(
  locationId: number | string,
  data: MoRBankDetails,
): Promise<void> {
  await apiClient.put(`/vendors/chain/locations/${locationId}/mor/bank-details`, data);
}
