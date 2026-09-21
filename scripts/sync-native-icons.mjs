/**
 * Writes auth-icon.png into Android launcher + splash resources.
 * Metro never updates these; they only change after a native rebuild.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('assets');
const RES = path.resolve('android/app/src/main/res');
const SOURCE = path.join(ROOT, 'auth-icon.png');
const CREAM = { r: 250, g: 247, b: 241, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const DENSITIES = [
  { folder: 'mdpi', scale: 1 },
  { folder: 'hdpi', scale: 1.5 },
  { folder: 'xhdpi', scale: 2 },
  { folder: 'xxhdpi', scale: 3 },
  { folder: 'xxxhdpi', scale: 4 },
];

/** Adaptive foreground: 10% smaller than the previous 0.72 fill. */
const FOREGROUND_FILL = 0.65;
const LAUNCHER_FILL = 0.83;

async function writeWebp(buffer, dest) {
  const tmp = `${dest}.gen`;
  await sharp(buffer).webp({ quality: 92 }).toFile(tmp);
  fs.copyFileSync(tmp, dest);
  fs.unlinkSync(tmp);
}

async function writePng(buffer, dest) {
  const tmp = `${dest}.gen`;
  await sharp(buffer).png({ compressionLevel: 9 }).toFile(tmp);
  fs.copyFileSync(tmp, dest);
  fs.unlinkSync(tmp);
}

async function plateOnCanvas(size, { fill = 1, background = TRANSPARENT } = {}) {
  const inner = Math.max(1, Math.round(size * fill));
  const plate = await sharp(SOURCE)
    .ensureAlpha()
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT, kernel: 'lanczos3' })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: plate, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing ${SOURCE}`);
  }
  if (!fs.existsSync(RES)) {
    throw new Error(`Missing Android res at ${RES}`);
  }

  for (const { folder, scale } of DENSITIES) {
    const launcherSize = Math.round(48 * scale);
    const foregroundSize = Math.round(108 * scale);
    const splashSize = Math.round(288 * scale);

    const mipmap = path.join(RES, `mipmap-${folder}`);
    const drawable = path.join(RES, `drawable-${folder}`);
    fs.mkdirSync(mipmap, { recursive: true });
    fs.mkdirSync(drawable, { recursive: true });

    const launcher = await plateOnCanvas(launcherSize, { fill: LAUNCHER_FILL, background: CREAM });
    await writeWebp(launcher, path.join(mipmap, 'ic_launcher.webp'));
    await writeWebp(launcher, path.join(mipmap, 'ic_launcher_round.webp'));

    const foreground = await plateOnCanvas(foregroundSize, {
      fill: FOREGROUND_FILL,
      background: TRANSPARENT,
    });
    await writeWebp(foreground, path.join(mipmap, 'ic_launcher_foreground.webp'));

    const splash = await plateOnCanvas(splashSize, { fill: 1, background: TRANSPARENT });
    await writePng(splash, path.join(drawable, 'splashscreen_logo.png'));
  }

  console.log('Synced auth-icon.png into Android launcher + splash resources');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
