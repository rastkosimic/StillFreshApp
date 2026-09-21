import apiClient from './apiClient';
import { getVendorRatingSummary as fetchVendorRatingSummary } from './ratingService';
import { normalizeImageUrl } from '@/utils/normalizeImageUrl';
import {
  ApiSuccessResponse,
  BankingModel,
  ChainBankingInfo,
  ChainLocation,
  DashboardPeriod,
  LocationCreationResponse,
  LocationRequest,
  Offer,
  OnboardingStatusResponse,
  PayoutModel,
  VendorDashboardResponse,
  VendorRatingSummary,
  VendorStatsResponse,
  ChainStatsResponse,
  StatsDateRangeParams,
  VendorType,
  Worker,
  WorkerRequest,
  WorkerUpdateRequest,
} from '@/types';

// ── Vendor Registration ───────────────────────────────────────────────────────

export interface ApplyVendorRequest {
  email: string;
  phone: string;
  businessAddress: string; // "{streetNumber} {streetName}, {city}, {state}, {zipCode}" — built client-side
  locationName: string;
  zipCode: string;
  businessRegistrationId?: string;
  contactPerson: string;
  latitude?: number;
  longitude?: number;
  // Legal acceptance: PendingVendorRegistrationRequest accepts the accepted document
  // versions. The server stamps the acceptance timestamps itself.
  termsVersion?: string;
  privacyVersion?: string;
}

export async function applyVendor(data: ApplyVendorRequest): Promise<void> {
  await apiClient.post('/vendors/apply', data);
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const response = await apiClient.get<OnboardingStatusResponse>('/vendors/onboarding/status');
  return response.data;
}

export async function setVendorType(vendorType: VendorType, chainName?: string): Promise<void> {
  await apiClient.put('/vendors/onboarding/set-vendor-type', { vendorType, chainName });
}

export interface AddHeadquartersRequest {
  locationName: string;
  address: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  phone: string;
  country: string;
}

export async function addHeadquarters(data: AddHeadquartersRequest): Promise<void> {
  await apiClient.put('/vendors/onboarding/add-headquarters', data);
}

export async function setBankingModel(model: BankingModel, country?: string): Promise<void> {
  await apiClient.put('/vendors/onboarding/set-banking-model', { bankingModel: model, country });
}

export async function setupPaymentAccount(): Promise<void> {
  await apiClient.post('/vendors/onboarding/setup-payment-account');
}

export async function completeOnboarding(): Promise<void> {
  await apiClient.post('/vendors/onboarding/complete');
}

export async function getPayoutModel(
  vendorId: number | string,
): Promise<{ payoutModel: PayoutModel }> {
  const response = await apiClient.get<{ payoutModel: PayoutModel }>(
    `/vendors/${vendorId}/payout-model`,
  );
  return response.data;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface VendorProfile {
  id: number;
  username?: string;
  email: string;
  address?: string;
  phone?: string;
  contactPerson?: string;
  role: string;
  businessType?: string;
  operatingHours?: string[];
  surplusFoodDetails?: string[];
  imageUrl?: string;
  zipCode?: string;
  country?: string;
  chainId?: string;
  chainName?: string;
  locationName?: string;
  aboutBusiness?: string;
  website?: string;
  environmentalCertifications?: string; // comma-separated
  isChainLocation: boolean;
  isHeadquarters: boolean;
  isUniqueVendor: boolean;
}

export async function getVendorProfile(userId: number | string): Promise<VendorProfile> {
  const response = await apiClient.get<Record<string, unknown>>(`/vendors/${userId}`);
  const raw = response.data;

  // The backend may return the "about" text as either `aboutBusiness` or `description`
  // depending on which version of the response DTO is active.
  const profile = raw as unknown as VendorProfile;
  profile.imageUrl = normalizeImageUrl(raw.imageUrl as string | undefined);

  if (!profile.aboutBusiness && raw.description) {
    profile.aboutBusiness = raw.description as string;
  }
  return profile;
}

export interface UpdateVendorProfileRequest {
  username?: string;
  businessType?: string;
  operatingHours?: string[];
  surplusFoodDetails?: string[];
  environmentalCertifications?: string; // comma-separated string
  imageUrl?: string;
  aboutBusiness?: string;
  phone?: string;
  contactPerson?: string;
  website?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  zipCode?: string;
}

export async function updateVendorProfile(data: UpdateVendorProfileRequest): Promise<void> {
  await apiClient.put('/vendors/update-profile', data);
}

export async function deleteVendorAccount(reason?: string, message?: string): Promise<void> {
  await apiClient.delete('/vendors/delete', { data: { reason, message } });
}

// ── Offers (vendor side) ──────────────────────────────────────────────────────

export interface CreateOfferRequest {
  name: string;
  description?: string;
  price: number; // float in currency units, e.g. 4.99
  originalPrice?: number; // float in currency units
  quantityAvailable: number;
  pickupStartTime: string; // HH:MM:SS
  pickupEndTime: string; // HH:MM:SS
  pickupDate: string; // YYYY-MM-DD
  category?: string;
  imageUrl?: string;
  dietaryInfo?: string;
  allergenInfo?: string;
}

export async function getAllOffers(): Promise<Offer[]> {
  const response = await apiClient.get<Offer[]>('/vendors/all-offers');
  return response.data.map((offer) => ({
    ...offer,
    imageUrl: normalizeImageUrl(offer.imageUrl),
  }));
}

export async function createOffer(data: CreateOfferRequest): Promise<void> {
  await apiClient.post('/vendors/offer-create', data);
}

export async function updateOffer(
  offerId: number | string,
  data: Partial<CreateOfferRequest>,
): Promise<void> {
  await apiClient.post(`/vendors/update-offer/${offerId}`, data);
}

export async function invalidateOffer(offerId: number | string): Promise<void> {
  await apiClient.post(`/vendors/invalidate-offer/${offerId}`, {});
}

// ── Chain Management ──────────────────────────────────────────────────────────

/**
 * The chain name travels as a query parameter, not a JSON body — the endpoint reads it from
 * the query string and a body is silently ignored, yielding a "chain name is required" 400.
 *
 * Preconditions the backend enforces: VENDOR_ADMIN role, not already part of a chain,
 * `onboardingStatus == COMPLETED`, and a chain name not taken by a different chain.
 */
export async function upgradeToChain(chainName: string): Promise<ApiSuccessResponse> {
  const response = await apiClient.post<ApiSuccessResponse>(
    '/vendors/upgrade-to-chain',
    undefined,
    { params: { chainName } },
  );
  return response.data;
}

export async function getChainBankingInfo(): Promise<ChainBankingInfo> {
  const response = await apiClient.get<ChainBankingInfo>('/vendors/chain/banking/info');
  return response.data;
}

export async function switchBankingModel(
  bankingModel: BankingModel,
): Promise<ApiSuccessResponse> {
  const response = await apiClient.put<ApiSuccessResponse>(
    '/vendors/chain/banking/switch-model',
    { bankingModel },
  );
  return response.data;
}

/** Workers are already filtered out server-side; never re-derive locations from elsewhere. */
export async function getChainLocations(): Promise<ChainLocation[]> {
  const response = await apiClient.get<ChainLocation[]>('/vendors/chain/locations');
  return response.data;
}

export async function addChainLocation(
  data: LocationRequest,
): Promise<LocationCreationResponse> {
  const response = await apiClient.post<LocationCreationResponse>(
    '/vendors/chain/locations',
    data,
  );
  return response.data;
}

/**
 * Full replacement, not a patch — every field is written unconditionally, so a partial body
 * blanks the fields it omits. Headquarters is rejected here; route it to updateVendorProfile.
 */
export async function updateChainLocation(
  locationId: number | string,
  data: LocationRequest,
): Promise<ApiSuccessResponse> {
  const response = await apiClient.put<ApiSuccessResponse>(
    `/vendors/chain/locations/${locationId}`,
    data,
  );
  return response.data;
}

/** Soft delete: the location becomes INACTIVE, its offers are invalidated and its workers
 *  are deactivated. Headquarters cannot be removed, and a location cannot remove itself. */
export async function removeChainLocation(
  locationId: number | string,
): Promise<ApiSuccessResponse> {
  const response = await apiClient.delete<ApiSuccessResponse>(
    `/vendors/chain/locations/${locationId}`,
  );
  return response.data;
}

export async function setupLocationPaymentAccount(
  locationId: number | string,
): Promise<ApiSuccessResponse> {
  const response = await apiClient.post<ApiSuccessResponse>(
    `/vendors/chain/locations/${locationId}/setup-payment-account`,
  );
  return response.data;
}

// ── Worker Management ─────────────────────────────────────────────────────────

export async function getLocationWorkers(locationId: number | string): Promise<Worker[]> {
  const response = await apiClient.get<Worker[]>(
    `/vendors/chain/locations/${locationId}/workers`,
  );
  return response.data;
}

export async function createWorker(
  locationId: number | string,
  data: WorkerRequest,
): Promise<ApiSuccessResponse> {
  const response = await apiClient.post<ApiSuccessResponse>(
    `/vendors/chain/locations/${locationId}/workers`,
    data,
  );
  return response.data;
}

export async function updateWorker(
  workerId: number | string,
  data: WorkerUpdateRequest,
): Promise<ApiSuccessResponse> {
  const response = await apiClient.put<ApiSuccessResponse>(
    `/vendors/chain/workers/${workerId}`,
    data,
  );
  return response.data;
}

export async function activateWorker(workerId: number | string): Promise<ApiSuccessResponse> {
  const response = await apiClient.put<ApiSuccessResponse>(
    `/vendors/chain/workers/${workerId}/activate`,
  );
  return response.data;
}

/** Revokes the worker's sessions immediately. The location's offers are unaffected. */
export async function deactivateWorker(workerId: number | string): Promise<ApiSuccessResponse> {
  const response = await apiClient.put<ApiSuccessResponse>(
    `/vendors/chain/workers/${workerId}/deactivate`,
  );
  return response.data;
}

/** Hard delete — also removes the login account, freeing the email for reuse. */
export async function deleteWorker(workerId: number | string): Promise<ApiSuccessResponse> {
  const response = await apiClient.delete<ApiSuccessResponse>(
    `/vendors/chain/workers/${workerId}`,
  );
  return response.data;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getVendorRatingSummary(
  vendorId: number | string,
): Promise<VendorRatingSummary> {
  return fetchVendorRatingSummary(vendorId);
}

export async function getDashboard(
  vendorId: number | string,
  period: DashboardPeriod = 'all',
  offerIds?: number[],
): Promise<VendorDashboardResponse> {
  const params: { period: DashboardPeriod; offerIds?: number[] } = { period };
  if (offerIds != null && offerIds.length > 0) {
    params.offerIds = offerIds;
  }
  const response = await apiClient.get<VendorDashboardResponse>(
    `/vendors/${vendorId}/dashboard`,
    {
      params,
      paramsSerializer: { indexes: null },
    },
  );
  return response.data;
}

export async function getVendorStats(
  params: StatsDateRangeParams = {},
): Promise<VendorStatsResponse> {
  const response = await apiClient.get<VendorStatsResponse>('/vendors/stats', {
    params,
    paramsSerializer: {
      serialize: (p) =>
        Object.entries(p)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&'),
    },
  });
  return response.data;
}

/** Headquarters VENDOR_ADMIN only — branch admins receive 403. Do not pass chainId. */
export async function getChainStats(
  params: StatsDateRangeParams = {},
): Promise<ChainStatsResponse> {
  const response = await apiClient.get<ChainStatsResponse>('/vendors/chain/stats', {
    params,
    // Ensure `+` / `:` in ISO datetimes are percent-encoded (never sent raw).
    paramsSerializer: {
      serialize: (p) =>
        Object.entries(p)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&'),
    },
  });
  return response.data;
}
