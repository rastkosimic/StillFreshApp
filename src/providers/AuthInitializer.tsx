import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

interface Props {
  children: React.ReactNode;
}

/**
 * Hydrates auth state from SecureStore + AsyncStorage on app start.
 * Renders a loading screen while hydration is in progress.
 */
export default function AuthInitializer({ children }: Props) {
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    void useAuthStore.getState().loadStoredAuth();
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return <>{children}</>;
}
