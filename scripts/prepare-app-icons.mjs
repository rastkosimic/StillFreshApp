/**
 * Builds Android adaptive icon layers from assets/auth-icon.png.
 * Does not modify icon.png, splash-icon.png, favicon.png, or auth-icon.png.
 */
import path from 'node:path';
import sharp from 'sharp';

const ASSETS_DIR = path.resolve('assets');
const BRAND_GREEN = '#2C5F2E';
const CANVAS_SIZE = 1024;
const FOREGROUND_SIZE = 666;

const SOURCE_ICON = path.join(ASSETS_DIR, 'auth-icon.png');
const OUTPUTS = {
  foreground: path.join(ASSETS_DIR, 'android-icon-foreground.png'),
  background: path.join(ASSETS_DIR, 'android-icon-background.png'),
  monochrome: path.join(ASSETS_DIR, 'android-icon-monochrome.png'),
};

async function buildForeground() {
  const icon = await sharp(SOURCE_ICON)
    .resize(FOREGROUND_SIZE, FOREGROUND_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(OUTPUTS.foreground);
}

async function buildBackground() {
  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 3,
      background: BRAND_GREEN,
    },
  })
    .png()
    .toFile(OUTPUTS.background);
}

async function buildMonochrome() {
  const { data, info } = await sharp(SOURCE_ICON)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      continue;
    }
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }

  const icon = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(FOREGROUND_SIZE, FOREGROUND_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(OUTPUTS.monochrome);
}

async function main() {
  await buildForeground();
  await buildBackground();
  await buildMonochrome();
  console.log('Prepared Android adaptive icons from assets/auth-icon.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
