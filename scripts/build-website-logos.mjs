/**
 * Website logo pack from assets/auth-icon.png (transparent plate, no green square).
 * Drop these onto https://www.jossveze.rs/ using the same filenames the site already serves.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = path.resolve('assets/auth-icon.png');
const OUT_DIR = path.resolve('assets/website');
const CREAM = '#FAF7F1';
const CREAM_RGB = { r: 250, g: 247, b: 241, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const GREEN = '#2E5A27';
const MUTED = '#5C6B57';
const ORANGE = '#C45C26';

async function plate(size, fill = 1) {
  const inner = Math.max(1, Math.round(size * fill));
  return sharp(SOURCE)
    .ensureAlpha()
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT, kernel: 'lanczos3' })
    .png()
    .toBuffer();
}

async function transparentLogo(size, dest, fill = 1) {
  const img = await plate(size, fill);
  if (fill === 1) {
    await sharp(img).png({ compressionLevel: 9 }).toFile(dest);
    return;
  }
  await sharp({
    create: { width: size, height: size, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: img, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

async function creamLogo(size, dest, fill) {
  const img = await plate(size, fill);
  await sharp({
    create: { width: size, height: size, channels: 4, background: CREAM_RGB },
  })
    .composite([{ input: img, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

async function ogImage(dest) {
  const width = 1200;
  const height = 630;
  const plateSize = 220;
  const mark = await plate(plateSize, 1);

  const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${CREAM}"/>
  <circle cx="80" cy="80" r="220" fill="${GREEN}" fill-opacity="0.05"/>
  <circle cx="1120" cy="560" r="260" fill="${GREEN}" fill-opacity="0.06"/>
  <text x="600" y="400" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="72" fill="${GREEN}">Još Sveže</text>
  <text x="600" y="458" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="${MUTED}">Hrana koja zaslužuje drugu šansu.</text>
  <text x="600" y="508" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="22" fill="${ORANGE}">Beograd · Uskoro na Google Play i App Store</text>
  <text x="600" y="552" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="${MUTED}">jossveze.rs</text>
</svg>`);

  await sharp(svg)
    .composite([{ input: mark, top: 88, left: Math.round((width - plateSize) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing ${SOURCE}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const out = (name) => path.join(OUT_DIR, name);

  await transparentLogo(512, out('logo.png'));
  await transparentLogo(192, out('logo-192.png'));
  await transparentLogo(64, out('logo-64.png'));
  await transparentLogo(32, out('favicon.png'));
  await transparentLogo(16, out('favicon-16.png'));
  await transparentLogo(32, out('favicon-32.png'));
  await creamLogo(180, out('apple-touch-icon.png'), 0.82);
  await creamLogo(192, out('android-chrome-192x192.png'), 0.8);
  await creamLogo(512, out('android-chrome-512x512.png'), 0.8);
  await ogImage(out('og-image.png'));

  console.log('Wrote website logos to', OUT_DIR);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
