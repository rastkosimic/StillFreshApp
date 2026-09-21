const fs = require('fs');
const path = require('path');
const {
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');

const DPI = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

function withNotificationIcons(config) {
  config = withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: 'notification_icon_color',
      value: '#9E9E9E',
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
      const projectRoot = cfg.modRequest.projectRoot;
      const icon = path.join(projectRoot, 'assets', 'notification-icon.png');
      const res = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

      for (const [name, scale] of Object.entries(DPI)) {
        const folder = path.join(res, `drawable-${name}`);
        fs.mkdirSync(folder, { recursive: true });
        const px = Math.round(24 * scale);
        const { source } = await generateImageAsync(
          { projectRoot, cacheType: 'android-notification-grey-white' },
          {
            src: icon,
            width: px,
            height: px,
            resizeMode: 'cover',
            backgroundColor: 'transparent',
          },
        );
        fs.writeFileSync(path.join(folder, 'notification_icon.png'), source);
      }

      const drawable = path.join(res, 'drawable');
      fs.mkdirSync(drawable, { recursive: true });
      const large = await generateImageAsync(
        { projectRoot, cacheType: 'android-notification-large-grey-white' },
        {
          src: icon,
          width: 256,
          height: 256,
          resizeMode: 'cover',
          backgroundColor: 'transparent',
        },
      );
      fs.writeFileSync(path.join(drawable, 'notification_large_icon.png'), large.source);
      return cfg;
    },
  ]);

  return config;
}

module.exports = withNotificationIcons;
