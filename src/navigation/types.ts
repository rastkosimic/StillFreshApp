import {
  BottomTabScreenProps,
  BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { ChainLocation, Offer } from '@/types';

// ── Param Lists ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  RoleSelection: undefined;
  CustomerRegister: undefined;
  VendorRegister: undefined;
  VendorApplicationSubmitted: undefined;
  RequestPasswordReset: undefined;
  ConfirmPasswordReset: { token: string };
};

export type OnboardingStackParamList = {
  OnboardingFlow: undefined;
  VendorTypeSelection: undefined;
  HeadquartersSetup: undefined;
  BankingModelSelection: undefined;
  VendorProfileCompletion: { isUniqueVendor: boolean; currentStatus: string };
  PaymentAccountSetup: { isUniqueVendor: boolean };
  OnboardingComplete: undefined;
};

export type CustomerTabParamList = {
  CustomerHome: undefined;
  Favorites: undefined;
  Orders: undefined;
  CustomerProfile: undefined;
};

export type CustomerStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList>;
  VendorMap: undefined;
  OfferDetails: { offerId: number };
  PaymentMethods: undefined;
  AllSecureCardRegistration: undefined;
  OrderPending: { offerId: number; quantity: number };
  OrderDetail: { orderId: number | string };
  OrderHistory: undefined;
  CustomerSettings: undefined;
  CustomerNotifications: undefined;
  NotificationPreferences: undefined;
};

export type VendorTabParamList = {
  VendorDashboard: undefined;
  VendorOffers: undefined;
  Analytics: undefined;
  VendorProfile: undefined;
};

export type VendorStackParamList = {
  VendorTabs: NavigatorScreenParams<VendorTabParamList>;
  CreateOffer: undefined;
  UpdateOffer: { offer: Offer; isReactivation: boolean };
  VendorOrderDetail: { orderId: number | string };
  VendorNotifications: undefined;
  NotificationPreferences: undefined;
  VendorPaymentSettings: undefined;
  VendorUpgradeToChain: undefined;
  VendorBankingModelManagement: undefined;
  VendorChainLocationManagement: { locationLimitReached?: boolean } | undefined;
  VendorLocationForm: { location?: ChainLocation; defaultCountry?: string } | undefined;
  VendorWorkerManagement: { locationId?: number; locationName?: string } | undefined;
  VendorResetPassword: undefined;
  VendorEditProfile: undefined;
  VendorStripeOnboarding: undefined;
  VendorBankAccounts: undefined;
  VendorAccountDetails: undefined;
  VendorRequirements: undefined;
  VendorMoRBankDetails:
    | {
        /** When set, uses GET/PUT .../locations/{id}/mor/bank-details (3.5b / 3.6b). */
        locationId: number;
        locationName?: string;
      }
    | undefined;
};

export type RootStackParamList = {
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  OnboardingStack: NavigatorScreenParams<OnboardingStackParamList>;
  CustomerStack: NavigatorScreenParams<CustomerStackParamList>;
  VendorStack: NavigatorScreenParams<VendorStackParamList>;
};

// ── Screen Prop Helpers ───────────────────────────────────────────────────────

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AuthStackParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

export type OnboardingStackScreenProps<T extends keyof OnboardingStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<OnboardingStackParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

export type CustomerStackScreenProps<T extends keyof CustomerStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CustomerStackParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

export type CustomerTabScreenProps<T extends keyof CustomerTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<CustomerTabParamList, T>,
    NativeStackScreenProps<CustomerStackParamList>
  >;

export type VendorStackScreenProps<T extends keyof VendorStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<VendorStackParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

export type VendorTabScreenProps<T extends keyof VendorTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<VendorTabParamList, T>,
    NativeStackScreenProps<VendorStackParamList>
  >;

// ── Navigation Prop Helpers (for use in non-screen components) ────────────────

export type AuthStackNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type CustomerTabNavigationProp = BottomTabNavigationProp<CustomerTabParamList>;
export type VendorTabNavigationProp = BottomTabNavigationProp<VendorTabParamList>;
