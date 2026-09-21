import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { API_BASE_URL, API_TIMEOUT } from '@/config/api';
import { ApiError } from '@/types';
import { isTokenExpiringSoon } from '@/utils/jwtDecoder';

// Extend AxiosRequestConfig to track whether a 401 has already been retried
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

const createApiClient = (defaultHeaders?: Record<string, string>): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    },
  });

  // ── Request interceptor ───────────────────────────────────────────────────
  instance.interceptors.request.use(
    async (config) => {
      // Import lazily to avoid circular dependency at module load time
      const { useAuthStore } = await import('@/stores/authStore');
      const { token } = useAuthStore.getState();

      if (token) {
        const { tokensIssuedAt } = useAuthStore.getState();
        const tokensJustIssued =
          tokensIssuedAt !== null && Date.now() - tokensIssuedAt < 60_000;

        // Proactively refresh if token expires within 5 minutes (skip right after login)
        if (!tokensJustIssued && isTokenExpiringSoon(token, 300)) {
          const refreshed = await useAuthStore.getState().refreshTokenAction();
          if (refreshed) {
            const newToken = useAuthStore.getState().token;
            if (newToken) {
              config.headers.Authorization = `Bearer ${newToken}`;
              return config;
            }
          }
        }
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  // ── Response interceptor ──────────────────────────────────────────────────
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as InternalAxiosRequestConfig;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        const { useAuthStore } = await import('@/stores/authStore');
        const refreshed = await useAuthStore.getState().refreshTokenAction();

        if (refreshed) {
          const newToken = useAuthStore.getState().token;
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return instance(originalRequest);
          }
        }

        // Only force logout when refreshTokenAction cleared the session (401 on refresh).
        // Other refresh failures (e.g. wrong endpoint) must not log out a valid session.
        if (!useAuthStore.getState().isAuthenticated) {
          return Promise.reject(buildApiError(error));
        }

        return Promise.reject(buildApiError(error));
      }

      return Promise.reject(buildApiError(error));
    },
  );

  return instance;
};

function buildApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errorMessage?: string; error?: string }
      | string
      | undefined;
    const fromBody =
      typeof data === 'string'
        ? data
        : (data?.errorMessage ?? data?.message ?? data?.error);
    const message = fromBody || error.message || 'An unexpected error occurred';
    return {
      message,
      status: error.response?.status,
      code: error.code,
    };
  }
  return {
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
}

const apiClient = createApiClient();

// Use this for endpoints that upload files (offer images, etc.)
// Uses the same interceptor logic as apiClient (proactive refresh + 401 retry).
export const multipartClient = createApiClient({ 'Content-Type': 'multipart/form-data' });

export default apiClient;
