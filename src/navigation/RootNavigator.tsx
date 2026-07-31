import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BrandLogo from '@/components/BrandLogo';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

import AuthStack from './AuthStack';
import CustomerStack from './CustomerStack';
import OnboardingStack from './OnboardingStack';
import VendorStack from './VendorStack';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <BrandLogo variant="icon" width={80} height={80} className="mb-6" />
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const isVendor = user?.role === 'VENDOR' || user?.role === 'VENDOR_ADMIN';
  // Vendor onboarding status is checked inside OnboardingFlowScreen.
  // RootNavigator only decides: AuthStack | CustomerTabs | OnboardingStack | VendorTabs.
  // For vendors, we default to OnboardingStack; OnboardingFlowScreen redirects to VendorTabs
  // once it confirms onboarding is COMPLETED and profileCompleted=true.
  const vendorNeedsOnboarding = isVendor && user?.profileCompleted !== true;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : isVendor && vendorNeedsOnboarding ? (
        <Stack.Screen name="OnboardingStack" component={OnboardingStack} />
      ) : isVendor ? (
        <Stack.Screen name="VendorStack" component={VendorStack} />
      ) : (
        <Stack.Screen name="CustomerStack" component={CustomerStack} />
      )}
    </Stack.Navigator>
  );
}
