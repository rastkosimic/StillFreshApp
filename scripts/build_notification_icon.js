const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'assets', 'notification-icon-source.png');
const outPath = path.join(__dirname, '..', 'assets', 'notification-icon.png');
const androidRes = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const size = 192;
const grey = { r: 158, g: 158, b: 158, alpha: 1 };

const DPI = {
  mdpi: 24,
  hdpi: 36,
  xhdpi: 48,
  xxhdpi: 72,
  xxxhdpi: 96,
};

async function buildAsset() {
  const src = sharp(srcPath).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });

  const glyph = Buffer.alloc(info.width * info.height * 4);
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const keep = a > 40 && r > 180 && g > 180 && b > 180;
      if (keep) {
        glyph[i] = 255;
        glyph[i + 1] = 255;
        glyph[i + 2] = 255;
        glyph[i + 3] = a;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = await sharp(glyph, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  const target = Math.round(size * 0.72);
  const scale = target / Math.max(cropW, cropH);
  const newW = Math.max(1, Math.round(cropW * scale));
  const newH = Math.max(1, Math.round(cropH * scale));
  const resizedGlyph = await sharp(cropped).resize(newW, newH).png().toBuffer();
  const left = Math.round((size - newW) / 2);
  const top = Math.round((size - newH) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: grey,
    },
  })
    .composite([{ input: resizedGlyph, left, top }])
    .png()
    .toFile(outPath);

  console.log(`wrote ${outPath} grey background white logo`);
  return outPath;
}

async function writeAndroidDrawables(assetPath) {
  if (!fs.existsSync(androidRes)) {
    console.log('android/ not present; skip native copy');
    return;
  }

  for (const [dpi, px] of Object.entries(DPI)) {
    const folder = path.join(androidRes, `drawable-${dpi}`);
    fs.mkdirSync(folder, { recursive: true });
    const dest = path.join(folder, 'notification_icon.png');
    await sharp(assetPath).resize(px, px, { fit: 'cover' }).png().toFile(dest);
    console.log(`wrote ${dest}`);
  }

  const drawable = path.join(androidRes, 'drawable');
  fs.mkdirSync(drawable, { recursive: true });
  await sharp(assetPath)
    .resize(256, 256, { fit: 'cover' })
    .png()
    .toFile(path.join(drawable, 'notification_large_icon.png'));

  const colorsPath = path.join(androidRes, 'values', 'colors.xml');
  if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf8');
    colors = colors.replace(
      /<color name="notification_icon_color">[^<]+<\/color>/,
      '<color name="notification_icon_color">#9E9E9E</color>',
    );
    fs.writeFileSync(colorsPath, colors);
  }
}

async function main() {
  const assetPath = await buildAsset();
  await writeAndroidDrawables(assetPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
