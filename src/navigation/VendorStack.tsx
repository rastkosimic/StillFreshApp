import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CreateOfferScreen from '@/screens/vendor/CreateOfferScreen';
import UpdateOfferScreen from '@/screens/vendor/UpdateOfferScreen';
import VendorOrderDetailScreen from '@/screens/vendor/VendorOrderDetailScreen';
import BankingModelManagementScreen from '@/screens/vendor/BankingModelManagementScreen';
import ChainLocationManagementScreen from '@/screens/vendor/ChainLocationManagementScreen';
import LocationFormScreen from '@/screens/vendor/LocationFormScreen';
import UpgradeToChainScreen from '@/screens/vendor/UpgradeToChainScreen';
import WorkerManagementScreen from '@/screens/vendor/WorkerManagementScreen';
import VendorResetPasswordScreen from '@/screens/vendor/VendorResetPasswordScreen';
import VendorEditProfileScreen from '@/screens/vendor/VendorEditProfileScreen';
import PaymentSettingsScreen from '@/screens/vendor/finance/PaymentSettingsScreen';
import StripeOnboardingScreen from '@/screens/vendor/finance/StripeOnboardingScreen';
import BankAccountsScreen from '@/screens/vendor/finance/BankAccountsScreen';
import AccountDetailsScreen from '@/screens/vendor/finance/AccountDetailsScreen';
import RequirementsScreen from '@/screens/vendor/finance/RequirementsScreen';
import MoRBankDetailsScreen from '@/screens/vendor/finance/MoRBankDetailsScreen';
import NotificationScreen from '@/screens/shared/NotificationScreen';
import NotificationPreferencesScreen from '@/screens/shared/NotificationPreferencesScreen';

import { VendorStackParamList } from './types';
import VendorTabs from './VendorTabs';

const Stack = createNativeStackNavigator<VendorStackParamList>();

export default function VendorStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VendorTabs" component={VendorTabs} />
      <Stack.Screen name="CreateOffer" component={CreateOfferScreen} />
      <Stack.Screen name="UpdateOffer" component={UpdateOfferScreen} />
      <Stack.Screen name="VendorOrderDetail" component={VendorOrderDetailScreen} />
      <Stack.Screen name="VendorNotifications" component={NotificationScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
      <Stack.Screen name="VendorPaymentSettings" component={PaymentSettingsScreen} />
      <Stack.Screen name="VendorUpgradeToChain" component={UpgradeToChainScreen} />
      <Stack.Screen name="VendorBankingModelManagement" component={BankingModelManagementScreen} />
      <Stack.Screen name="VendorChainLocationManagement" component={ChainLocationManagementScreen} />
      <Stack.Screen name="VendorLocationForm" component={LocationFormScreen} />
      <Stack.Screen name="VendorWorkerManagement" component={WorkerManagementScreen} />
      <Stack.Screen name="VendorResetPassword" component={VendorResetPasswordScreen} />
      <Stack.Screen name="VendorEditProfile" component={VendorEditProfileScreen} />
      <Stack.Screen name="VendorStripeOnboarding" component={StripeOnboardingScreen} />
      <Stack.Screen name="VendorBankAccounts" component={BankAccountsScreen} />
      <Stack.Screen name="VendorAccountDetails" component={AccountDetailsScreen} />
      <Stack.Screen name="VendorRequirements" component={RequirementsScreen} />
      <Stack.Screen name="VendorMoRBankDetails" component={MoRBankDetailsScreen} />
    </Stack.Navigator>
  );
}
