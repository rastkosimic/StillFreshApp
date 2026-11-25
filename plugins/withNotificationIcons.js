const {
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
function withNotificationIcons(config) {
  config = withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: 'notification_icon_color',
      value: '#FFFFFF',
    });
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      'expo.modules.notifications.large_notification_icon',
      '@drawable/notification_large_icon',
      'resource',
    );
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const { writeAndroidDrawables } = require('../scripts/build_notification_icon');
      await writeAndroidDrawables();
      return cfg;
    },
  ]);

  return config;
}

module.exports = withNotificationIcons;
