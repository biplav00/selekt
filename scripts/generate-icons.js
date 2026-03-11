import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 48, 128];
const inputPath = join(__dirname, '../src/icons/icon.svg');
const outputDir = join(__dirname, '../src/icons');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log('Generating icons...');

  for (const size of sizes) {
    const outputPath = join(outputDir, `${size}.png`);
    await sharp(inputPath).resize(size, size).png().toFile(outputPath);
    console.log(`Created ${size}x${size} icon`);
  }

  console.log('Done!');
}

generateIcons().catch(console.error);
