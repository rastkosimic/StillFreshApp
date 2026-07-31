import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AllSecureCardRegistrationScreen from '@/screens/customer/AllSecureCardRegistrationScreen';
import CustomerSettingsScreen from '@/screens/customer/CustomerSettingsScreen';
import OfferDetailsScreen from '@/screens/customer/OfferDetailsScreen';
import OrderDetailScreen from '@/screens/customer/OrderDetailScreen';
import OrderHistoryScreen from '@/screens/customer/OrderHistoryScreen';
import OrderPendingScreen from '@/screens/customer/OrderPendingScreen';
import PaymentMethodsScreen from '@/screens/customer/PaymentMethodsScreen';
import VendorMapScreen from '@/screens/customer/VendorMapScreen';
import NotificationScreen from '@/screens/shared/NotificationScreen';
import NotificationPreferencesScreen from '@/screens/shared/NotificationPreferencesScreen';

import { CustomerStackParamList } from './types';
import CustomerTabs from './CustomerTabs';

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
      <Stack.Screen name="VendorMap" component={VendorMapScreen} />
      <Stack.Screen name="OfferDetails" component={OfferDetailsScreen} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Stack.Screen name="AllSecureCardRegistration" component={AllSecureCardRegistrationScreen} />
      <Stack.Screen name="OrderPending" component={OrderPendingScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="CustomerSettings" component={CustomerSettingsScreen} />
      <Stack.Screen name="CustomerNotifications" component={NotificationScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
    </Stack.Navigator>
  );
}
