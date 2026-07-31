import apiClient from './apiClient';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '@/config/api';
import { User, UserRole, VendorInfo } from '@/types';
import { decodeJWTPayload } from '@/utils/jwtDecoder';

// Raw shape returned by the backend
interface RawAuthResponse {
  accessJwt: string;
  refreshToken: string;
  jwt?: string; // legacy duplicate of accessJwt
  role: string;
  vendor?: VendorInfo | null;
  accountWasDeleted?: boolean;
}

// Normalised shape used throughout the app
export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  vendor?: VendorInfo;
  accountWasDeleted?: boolean;
}

export interface GoogleLoginRequest {
  idToken: string;
  role?: 'USER' | 'VENDOR';
  isSignUp?: boolean;
}

/** Build a minimal User from the JWT payload claims. */
function userFromToken(token: string, role: string): User {
  const payload = decodeJWTPayload(token);
  return {
    id: (payload?.userId as number) ?? 0,
    email: (payload?.email as string) ?? '',
    username: payload?.sub as string | undefined,
    role: role as UserRole,
  };
}

/** Normalise the raw backend response into the app's LoginResponse shape. */
function normalise(raw: RawAuthResponse): LoginResponse {
  const token = raw.accessJwt ?? raw.jwt ?? '';
  const vendor = raw.vendor ?? undefined;
  return {
    token,
    refreshToken: raw.refreshToken ?? '',
    user: { ...userFromToken(token, raw.role), vendor },
    vendor,
    accountWasDeleted: raw.accountWasDeleted,
  };
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<RawAuthResponse>('/auth/login', { identifier, password });
  return normalise(response.data);
}

export async function googleLogin(request: GoogleLoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<RawAuthResponse>('/auth/google-login', request);
  return normalise(response.data);
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function forgotPassword(email: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email, newPassword });
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  await apiClient.post('/auth/reset-password', { token, newPassword, confirmPassword });
}

export async function changePassword(
  email: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  await apiClient.post('/auth/change-password', { email, newPassword, confirmPassword });
}

export async function refreshToken(refreshTokenValue: string): Promise<{
  token: string;
  refreshToken: string;
}> {
  const response = await axios.post<{
    accessJwt?: string;
    jwt?: string;
    refreshToken: string;
  }>(
    `${API_BASE_URL}/auth/refresh-token`,
    { refreshToken: refreshTokenValue },
    {
      timeout: API_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  const token = response.data.accessJwt ?? response.data.jwt ?? '';
  return { token, refreshToken: response.data.refreshToken };
}
