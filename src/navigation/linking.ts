import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['stillfresh://'],
  config: {
    screens: {
      AuthStack: {
        screens: {
          // stillfresh://auth/reset-password?token=... → ConfirmPasswordReset
          ConfirmPasswordReset: {
            path: 'auth/reset-password',
            parse: {
              token: (token: string) => token,
            },
          },
        },
      },
      // Stripe deep links (stillfresh://vendors/stripe/return|refresh) are handled
      // via Linking.addEventListener inside StripeOnboardingScreen, not screen routing.
      OnboardingStack: {
        screens: {
          OnboardingFlow: 'onboarding',
        },
      },
      CustomerStack: {
        screens: {
          CustomerTabs: {
            screens: {
              CustomerHome: 'home',
            },
          },
        },
      },
      VendorStack: {
        screens: {
          VendorTabs: {
            screens: {
              VendorDashboard: 'dashboard',
            },
          },
        },
      },
    },
  },
};
