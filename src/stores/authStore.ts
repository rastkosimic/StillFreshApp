import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { API_BASE_URL } from '@/config/api';
import { User } from '@/types';

const SECURE_KEY_TOKEN = 'auth_token';
const SECURE_KEY_REFRESH = 'refresh_token';
const ASYNC_KEY_USER = 'user_data';

export type SessionEndedReason = 'suspended' | 'expired' | 'deactivated' | null;

interface RawRefreshResponse {
  accessJwt?: string;
  jwt?: string;
  refreshToken: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshPromise: Promise<boolean> | null;
  sessionEndedReason: SessionEndedReason;
  /** Timestamp when tokens were last issued (login or refresh). */
  tokensIssuedAt: number | null;
}

interface AuthActions {
  login: (token: string, refreshToken: string, user: User) => Promise<void>;
  logout: (reason?: SessionEndedReason) => Promise<void>;
  refreshTokenAction: () => Promise<boolean>;
  loadStoredAuth: () => Promise<void>;
  setUser: (user: User) => Promise<void>;
  setLoading: (loading: boolean) => void;
  clearSessionEndedReason: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isRefreshing: false,
  refreshPromise: null,
  sessionEndedReason: null,
  tokensIssuedAt: null,

  login: async (token, refreshToken, user) => {
    await SecureStore.setItemAsync(SECURE_KEY_TOKEN, token);
    if (refreshToken) {
      await SecureStore.setItemAsync(SECURE_KEY_REFRESH, refreshToken);
    }
    await AsyncStorage.setItem(ASYNC_KEY_USER, JSON.stringify(user));
    set({
      token,
      refreshToken: refreshToken || null,
      user,
      isAuthenticated: true,
      isLoading: false,
      sessionEndedReason: null,
      tokensIssuedAt: Date.now(),
    });
  },

  logout: async (reason = null) => {
    const { token } = get();

    // 1. Best-effort FCM token deregistration — must run before JWT is cleared
    if (token) {
      try {
        const { removeFCMToken } = await import('@/services/notificationService');
        await removeFCMToken();
      } catch {
        // Non-fatal: logout must continue even if deregister fails
      }
    }

    set({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isRefreshing: false,
      refreshPromise: null,
      sessionEndedReason: reason,
      tokensIssuedAt: null,
    });

    // 2. Clear persisted storage (fire and forget)
    SecureStore.deleteItemAsync(SECURE_KEY_TOKEN).catch(() => {});
    SecureStore.deleteItemAsync(SECURE_KEY_REFRESH).catch(() => {});
    AsyncStorage.removeItem(ASYNC_KEY_USER).catch(() => {});

    // 3. Clear notification state
    import('@/stores/notificationStore').then(({ useNotificationStore }) => {
      useNotificationStore.getState().resetUnreadCount();
    }).catch(() => {});

    import('@/stores/basketStore').then(({ useBasketStore }) => {
      useBasketStore.getState().resetBasketCount();
    }).catch(() => {});

    // 4. Clear favorites — dynamic import avoids circular dependency at module load time
    import('@/stores/favoritesStore').then(({ useFavoritesStore }) => {
      useFavoritesStore.getState().reset();
    }).catch(() => {});

    // 4. Best-effort server-side logout using raw axios to bypass the
    //    apiClient interceptors — avoids recursive logout triggered by
    //    the response interceptor on 401.
    if (token) {
      axios
        .post(
          `${API_BASE_URL}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 },
        )
        .catch(() => {});
    }
  },

  refreshTokenAction: (): Promise<boolean> => {
    const state = get();

    // Deduplicate: if already refreshing, return the same promise
    if (state.isRefreshing && state.refreshPromise) {
      return state.refreshPromise;
    }

    const promise: Promise<boolean> = (async () => {
      const currentRefreshToken = get().refreshToken;
      if (!currentRefreshToken) {
        await get().logout();
        return false;
      }

      try {
        const response = await axios.post<RawRefreshResponse>(
          `${API_BASE_URL}/auth/refresh-token`,
          { refreshToken: currentRefreshToken },
          {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
          },
        );
        const token = response.data.accessJwt ?? response.data.jwt ?? '';
        const refreshToken = response.data.refreshToken;
        if (!token || !refreshToken) {
          return false;
        }
        await SecureStore.setItemAsync(SECURE_KEY_TOKEN, token);
        await SecureStore.setItemAsync(SECURE_KEY_REFRESH, refreshToken);
        set({
          token,
          refreshToken,
          isRefreshing: false,
          refreshPromise: null,
          tokensIssuedAt: Date.now(),
        });
        return true;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          await get().logout('expired');
        }
        set({ isRefreshing: false, refreshPromise: null });
        return false;
      }
    })();

    set({ isRefreshing: true, refreshPromise: promise });
    return promise;
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });
    try {
      const [token, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEY_TOKEN),
        SecureStore.getItemAsync(SECURE_KEY_REFRESH),
        AsyncStorage.getItem(ASYNC_KEY_USER),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        set({ token, refreshToken, user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: async (user) => {
    await AsyncStorage.setItem(ASYNC_KEY_USER, JSON.stringify(user));
    set({ user });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  clearSessionEndedReason: () => set({ sessionEndedReason: null }),
}));
