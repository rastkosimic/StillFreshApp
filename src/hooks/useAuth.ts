import { useAuthStore } from '@/stores/authStore';
import { User } from '@/types';

interface UseAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const { user, isAuthenticated, isLoading, login, logout } = useAuthStore();
  return { user, isAuthenticated, isLoading, login, logout };
}
