/**
 * Removes baked-in transparency checkerboard from AI-generated PNGs.
 *
 * Strategy:
 * 1. Flood-fill from image edges through neutral light gray/white pixels.
 * 2. Optional global pass for enclosed checkerboard islands (auth-icon only).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ASSETS_DIR = path.resolve('assets');

const TARGETS = [
  { fileName: 'auth-icon.png', globalPass: true },
  { fileName: 'splash-icon.png', globalPass: false },
];

function isCheckerboardPixel(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  return spread <= 6 && brightness >= 215;
}

async function fixCheckerboard(filePath, globalPass) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushIfCheckerboard = (x, y) => {
    const index = y * width + x;
    if (visited[index]) {
      return;
    }

    const offset = index * 4;
    if (!isCheckerboardPixel(data[offset], data[offset + 1], data[offset + 2])) {
      return;
    }

    visited[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfCheckerboard(x, 0);
    pushIfCheckerboard(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfCheckerboard(0, y);
    pushIfCheckerboard(width - 1, y);
  }

  let floodCount = 0;
  while (queue.length > 0) {
    const index = queue.pop();
    const x = index % width;
    const y = (index - x) / width;

    data[index * 4 + 3] = 0;
    floodCount += 1;

    if (x > 0) pushIfCheckerboard(x - 1, y);
    if (x < width - 1) pushIfCheckerboard(x + 1, y);
    if (y > 0) pushIfCheckerboard(x, y - 1);
    if (y < height - 1) pushIfCheckerboard(x, y + 1);
  }

  let globalCount = 0;
  if (globalPass) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) {
        continue;
      }
      if (isCheckerboardPixel(data[i], data[i + 1], data[i + 2])) {
        data[i + 3] = 0;
        globalCount += 1;
      }
    }
  }

  const backupPath = `${filePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(`${filePath}.fixed`);

  fs.renameSync(`${filePath}.fixed`, filePath);

  return { floodCount, globalCount };
}

async function main() {
  for (const { fileName, globalPass } of TARGETS) {
    const filePath = path.join(ASSETS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing file: ${filePath}`);
      continue;
    }

    const { floodCount, globalCount } = await fixCheckerboard(filePath, globalPass);
    console.log(
      `Fixed ${fileName}: flood=${floodCount}${globalPass ? `, global=${globalCount}` : ''}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
