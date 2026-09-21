import './global.css';

import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';

import { STRIPE_MERCHANT_ID, STRIPE_PUBLISHABLE_KEY, STRIPE_URL_SCHEME } from '@/config/stripe';
import { i18n } from '@/localization';
import RootNavigator from '@/navigation/RootNavigator';
import AuthInitializer from '@/providers/AuthInitializer';
import GeolocationProvider from '@/providers/GeolocationProvider';
import NotificationInitializer from '@/providers/NotificationInitializer';
import { navigationRef } from '@/navigation/navigationRef';
import { navigationTheme } from '@/theme/navigationTheme';
import { colors } from '@/theme/colors';
import { applyDefaultUiFont } from '@/theme/typography';
import { linking } from './src/navigation/linking';

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  applyDefaultUiFont();

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier={STRIPE_MERCHANT_ID}
          urlScheme={STRIPE_URL_SCHEME}
        >
          <I18nextProvider i18n={i18n}>
            <AuthInitializer>
              <NotificationInitializer />
              <GeolocationProvider>
                <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking}>
                  <RootNavigator />
                </NavigationContainer>
              </GeolocationProvider>
            </AuthInitializer>
          </I18nextProvider>
        </StripeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
