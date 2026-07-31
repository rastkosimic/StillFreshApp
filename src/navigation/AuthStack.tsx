import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ConfirmPasswordResetScreen from '@/screens/auth/ConfirmPasswordResetScreen';
import CustomerRegisterScreen from '@/screens/auth/CustomerRegisterScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import RequestPasswordResetScreen from '@/screens/auth/RequestPasswordResetScreen';
import RoleSelectionScreen from '@/screens/auth/RoleSelectionScreen';
import VendorApplicationSubmittedScreen from '@/screens/auth/VendorApplicationSubmittedScreen';
import VendorRegisterScreen from '@/screens/auth/VendorRegisterScreen';

import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="CustomerRegister" component={CustomerRegisterScreen} />
      <Stack.Screen name="VendorRegister" component={VendorRegisterScreen} />
      <Stack.Screen name="VendorApplicationSubmitted" component={VendorApplicationSubmittedScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="RequestPasswordReset" component={RequestPasswordResetScreen} />
      <Stack.Screen
        name="ConfirmPasswordReset"
        component={ConfirmPasswordResetScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
