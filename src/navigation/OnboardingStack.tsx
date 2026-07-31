import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BankingModelSelectionScreen from '@/screens/vendor/onboarding/BankingModelSelectionScreen';
import HeadquartersSetupScreen from '@/screens/vendor/onboarding/HeadquartersSetupScreen';
import OnboardingCompleteScreen from '@/screens/vendor/onboarding/OnboardingCompleteScreen';
import OnboardingFlowScreen from '@/screens/vendor/onboarding/OnboardingFlowScreen';
import PaymentAccountSetupScreen from '@/screens/vendor/onboarding/PaymentAccountSetupScreen';
import VendorProfileCompletionScreen from '@/screens/vendor/onboarding/VendorProfileCompletionScreen';
import VendorTypeSelectionScreen from '@/screens/vendor/onboarding/VendorTypeSelectionScreen';

import { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingStack() {
  return (
    <Stack.Navigator
      initialRouteName="OnboardingFlow"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      {/* Hub screen — must not allow back gesture (it auto-routes on focus) */}
      <Stack.Screen name="OnboardingFlow" component={OnboardingFlowScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="VendorTypeSelection" component={VendorTypeSelectionScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="HeadquartersSetup" component={HeadquartersSetupScreen} />
      <Stack.Screen name="BankingModelSelection" component={BankingModelSelectionScreen} />
      <Stack.Screen name="VendorProfileCompletion" component={VendorProfileCompletionScreen} />
      <Stack.Screen name="PaymentAccountSetup" component={PaymentAccountSetupScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
