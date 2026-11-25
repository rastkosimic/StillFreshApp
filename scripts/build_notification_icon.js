const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'assets', 'notification-icon-source.png');
const outPath = path.join(__dirname, '..', 'assets', 'notification-icon.png');
const androidRes = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const size = 192;
/** Large icon on the right of a notification. */
const LARGE_FILL = 0.72;
/** Status bar and the small icon on the left. 50% larger than LARGE_FILL, then 5% smaller. */
const SMALL_FILL = LARGE_FILL * 1.5 * 0.95;
const ICON_COLOR = '#FFFFFF';

const DPI = {
  mdpi: 24,
  hdpi: 36,
  xhdpi: 48,
  xxhdpi: 72,
  xxxhdpi: 96,
};

/**
 * Android status-bar icons are an alpha mask. Any opaque pixel, including a
 * grey plate behind the logo, is tinted as a solid square. Keep only the
 * white outline and a transparent background.
 */
async function whiteSilhouette(targetSize, fill) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const glyph = Buffer.alloc(info.width * info.height * 4);
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      // Source art has a baked-in checkerboard (~90–135). The outline is near-white.
      if (lum < 170) continue;
      const alpha = Math.round(Math.min(255, ((lum - 170) / (255 - 170)) * 255));
      if (alpha < 16) continue;
      glyph[i] = 255;
      glyph[i + 1] = 255;
      glyph[i + 2] = 255;
      glyph[i + 3] = alpha;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`No visible pixels in ${srcPath}`);
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = await sharp(glyph, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  const inner = Math.max(1, Math.round(targetSize * fill));
  const resized = await sharp(cropped)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  if (inner > targetSize) {
    const offset = Math.floor((inner - targetSize) / 2);
    return sharp(resized)
      .extract({ left: offset, top: offset, width: targetSize, height: targetSize })
      .png()
      .toBuffer();
  }

  return sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function buildAsset() {
  const png = await whiteSilhouette(size, SMALL_FILL);
  await sharp(png).png().toFile(outPath);
  console.log(`wrote ${outPath} (white outline, transparent background)`);
  return outPath;
}

async function writeAndroidDrawables() {
  if (!fs.existsSync(androidRes)) {
    console.log('android/ not present; skip native copy');
    return;
  }

  for (const [dpi, px] of Object.entries(DPI)) {
    const folder = path.join(androidRes, `drawable-${dpi}`);
    fs.mkdirSync(folder, { recursive: true });
    const dest = path.join(folder, 'notification_icon.png');
    await sharp(await whiteSilhouette(px, SMALL_FILL)).png().toFile(dest);
    console.log(`wrote ${dest}`);
  }

  const drawable = path.join(androidRes, 'drawable');
  fs.mkdirSync(drawable, { recursive: true });
  await sharp(await whiteSilhouette(256, LARGE_FILL))
    .png()
    .toFile(path.join(drawable, 'notification_large_icon.png'));
  console.log('wrote notification_large_icon.png');

  const colorsPath = path.join(androidRes, 'values', 'colors.xml');
  if (fs.existsSync(colorsPath)) {
    const colors = fs.readFileSync(colorsPath, 'utf8');
    const next = colors.replace(
      /<color name="notification_icon_color">[^<]+<\/color>/,
      `<color name="notification_icon_color">${ICON_COLOR}</color>`,
    );
    if (next !== colors) {
      fs.writeFileSync(colorsPath, next);
      console.log(`set notification_icon_color to ${ICON_COLOR}`);
    }
  }
}

async function main() {
  await buildAsset();
  await writeAndroidDrawables();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildAsset, writeAndroidDrawables, whiteSilhouette };
