import Constants from 'expo-constants';

function resolveStripePublishableKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (fromEnv) return fromEnv;

  const fromExtra = Constants.expoConfig?.extra?.stripePublishableKey;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;

  return '';
}

// Stripe publishable key — test or live pk_… from env / EAS secrets. Never use sk_* here.
export const STRIPE_PUBLISHABLE_KEY = resolveStripePublishableKey();

if (__DEV__ && !STRIPE_PUBLISHABLE_KEY) {
  console.warn(
    '[stripe] EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing. Set it in .env (see .env.example).',
  );
}

export const STRIPE_MERCHANT_ID = 'merchant.com.stillfreshmobile';

export const STRIPE_URL_SCHEME = 'stillfresh';
