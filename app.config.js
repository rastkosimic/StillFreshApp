// Dynamic Expo config — extends app.json with runtime secrets.
// The static app.json is the source of truth for all non-sensitive values.
// Sensitive keys are injected here from environment variables so they never
// land in app.json (which is committed to git).
//
// Local dev:  values come from .env (gitignored) via Expo CLI's built-in dotenv loader
// EAS builds: values come from EAS secrets set in the project dashboard

/** @type {(ctx: import('@expo/config').ConfigContext) => import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

  const plugins = (config.plugins ?? []).map((plugin) => {
    if (plugin === 'react-native-maps') {
      return ['react-native-maps', { androidGoogleMapsApiKey: googleMapsApiKey }];
    }

    if (Array.isArray(plugin) && plugin[0] === 'react-native-maps') {
      return [
        'react-native-maps',
        { ...plugin[1], androidGoogleMapsApiKey: googleMapsApiKey },
      ];
    }

    return plugin;
  });

  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...config.extra,
      stripePublishableKey,
      googleWebClientId,
    },
  };
};
