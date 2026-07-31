import apiClient from './apiClient';
import { User } from '@/types';
import { normalizeOptionalField } from '@/utils/userHelpers';

export interface RegisterCustomerRequest {
  username: string;
  email: string;
  password: string;
  // Legal acceptance: send the version of each document the user accepted at signup.
  // The server stamps termsAcceptedAt / privacyAcceptedAt itself — never send timestamps.
  termsVersion?: string;
  privacyVersion?: string;
}

export interface UpdateNameRequest {
  firstName?: string;
  lastName?: string;
}

export interface UpdatePhoneRequest {
  phoneNumber?: string;
}

export interface UpdateAddressRequest {
  address?: string;
}

export interface UpdateCountryRequest {
  country?: string;
}

export interface UpdateBirthdayRequest {
  birthday?: string;
}

export interface UpdateDietaryPreferenceRequest {
  dietaryPreference?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  country?: string;
  birthday?: string;
  dietaryPreference?: string;
}

export interface DeleteAccountRequest {
  reason?: string;
  message?: string;
}

const PROFILE_RETRY_DELAY_MS = 750;

/**
 * Normalizes the raw user object from the API, which uses inconsistent field names
 * (e.g. 'name' vs 'firstName'/'lastName', 'phone' vs 'phoneNumber').
 * Never persists the password field.
 */
export function normalizeUser(raw: Record<string, unknown>): User {
  const { password: _password, ...safeRaw } = raw;

  const firstName =
    (safeRaw.firstName as string | undefined) ??
    (typeof safeRaw.name === 'string' ? safeRaw.name.split(' ')[0] : undefined);
  const lastName =
    (safeRaw.lastName as string | undefined) ??
    (typeof safeRaw.name === 'string' ? safeRaw.name.split(' ').slice(1).join(' ') : undefined);
  const phoneNumber =
    (safeRaw.phoneNumber as string | undefined) ?? (safeRaw.phone as string | undefined);
  const country =
    (safeRaw.country as string | undefined) ?? (safeRaw.countryCode as string | undefined);

  return {
    ...(safeRaw as unknown as User),
    firstName,
    lastName,
    phoneNumber,
    country,
  };
}

function mergeProfileWithSession(profile: User, sessionUser: User): User {
  return {
    ...sessionUser,
    ...profile,
    role: sessionUser.role,
    vendor: sessionUser.vendor ?? profile.vendor,
  };
}

export async function registerCustomer(request: RegisterCustomerRequest): Promise<void> {
  await apiClient.post('/users/register', request);
}

export async function getProfile(): Promise<User> {
  const response = await apiClient.get<Record<string, unknown>>('/users');
  return normalizeUser(response.data);
}

export async function fetchProfileWithRetry(maxAttempts = 2): Promise<User> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await getProfile();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}

export async function loadCustomerProfileAfterAuth(sessionUser: User): Promise<User> {
  const profile = await fetchProfileWithRetry();
  return mergeProfileWithSession(profile, sessionUser);
}

export async function updateName(request: UpdateNameRequest): Promise<User> {
  const response = await apiClient.put<Record<string, unknown>>('/users/profile/name', {
    firstName: normalizeOptionalField(request.firstName ?? ''),
    lastName: normalizeOptionalField(request.lastName ?? ''),
  });
  return normalizeUser(response.data);
}

export async function updatePhone(request: UpdatePhoneRequest): Promise<User> {
  const response = await apiClient.put<Record<string, unknown>>('/users/profile/phone', {
    phoneNumber: normalizeOptionalField(request.phoneNumber ?? ''),
  });
  return normalizeUser(response.data);
}

export async function updateAddress(request: UpdateAddressRequest): Promise<User> {
  const response = await apiClient.put<Record<string, unknown>>('/users/profile/address', {
    address: normalizeOptionalField(request.address ?? ''),
  });
  return normalizeUser(response.data);
}

export async function updateCountry(request: UpdateCountryRequest): Promise<User> {
  const response = await apiClient.put<Record<string, unknown>>('/users/profile/country', {
    country: normalizeOptionalField(request.country ?? ''),
  });
  return normalizeUser(response.data);
}

export async function updateBirthday(request: UpdateBirthdayRequest): Promise<User> {
  const response = await apiClient.put<Record<string, unknown>>('/users/profile/birthday', {
    birthday: normalizeOptionalField(request.birthday ?? ''),
  });
  return normalizeUser(response.data);
}

export async function updateDietaryPreference(
  request: UpdateDietaryPreferenceRequest,
): Promise<User> {
  const response = await apiClient.put<Record<string, unknown>>(
    '/users/profile/dietary-preference',
    { dietaryPreference: normalizeOptionalField(request.dietaryPreference ?? '') },
  );
  return normalizeUser(response.data);
}

/** Partial update fallback — kept for compatibility with APP_SPEC. */
export async function updateProfile(fields: UpdateProfileRequest): Promise<User> {
  const response = await apiClient.put<Record<string, unknown>>('/users', fields);
  return normalizeUser(response.data);
}

export async function deleteAccount(request?: DeleteAccountRequest): Promise<void> {
  await apiClient.delete('/users/delete', { data: request });
}
