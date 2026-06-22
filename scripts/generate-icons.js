import fs from 'fs';
import path from 'path';
import { Jimp } from 'jimp';

// Path configuration
const svgPath = 'c:/Users/Dwayne/Documents/Projects/habits-social/public/favicon-rounded.svg';
const outputDir = 'c:/Users/Dwayne/Documents/Projects/habits-social/public/icons';

// Dimensions for all the required icons
const icons = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon.png', size: 32 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-4k.png', size: 3840 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-large.png', size: 1024 },
  { name: 'icon-maskable-512.png', size: 512, maskable: true }
];

// Helper to convert 32-bit integer to RGBA
function intToRGBA(val) {
  const r = Math.floor(val / 0x1000000) & 0xff;
  const g = Math.floor(val / 0x10000) & 0xff;
  const b = Math.floor(val / 0x100) & 0xff;
  const a = val & 0xff;
  return { r, g, b, a };
}

// Helper to convert RGBA to 32-bit integer
function rgbaToInt(r, g, b, a) {
  return r * 0x1000000 + g * 0x10000 + b * 0x100 + a;
}

async function main() {
  try {
    console.log('Reading favicon-rounded.svg...');
    const svgContent = fs.readFileSync(svgPath, 'utf-8');

    // Extract base64 image data using RegExp
    const base64Match = svgContent.match(/href="data:image\/png;base64,([^"]+)"/);
    if (!base64Match) {
      throw new Error('Could not find base64 image data in SVG!');
    }

    const base64Data = base64Match[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    console.log('Loading source image into Jimp...');
    const sourceImage = await Jimp.read(imageBuffer);
    console.log(`Source image loaded. Size: ${sourceImage.width}x${sourceImage.height}`);

    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Reusable circular icon renderer matching the SVG's viewBox 0 0 100 100
    function renderCircularIcon(size) {
      const N = size;
      const canvas = new Jimp({ width: N, height: N, color: 0x00000000 });
      const scaledSize = Math.round(1.35 * N);
      const offset = Math.round(-0.175 * N);
      const resizedSrc = sourceImage.clone().resize({ w: scaledSize, h: scaledSize });
      const halfN = N / 2;
      const radius = N / 2;

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const dx = (x + 0.5) - halfN;
          const dy = (y + 0.5) - halfN;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= radius) {
            const srcX = x - offset;
            const srcY = y - offset;
            let r = 255, g = 255, b = 255, a = 255;
            if (srcX >= 0 && srcX < scaledSize && srcY >= 0 && srcY < scaledSize) {
              const hexColor = resizedSrc.getPixelColor(srcX, srcY);
              const rgba = intToRGBA(hexColor);
              const alpha = rgba.a / 255;
              r = Math.round(rgba.r * alpha + 255 * (1 - alpha));
              g = Math.round(rgba.g * alpha + 255 * (1 - alpha));
              b = Math.round(rgba.b * alpha + 255 * (1 - alpha));
              a = 255;
            }
            canvas.setPixelColor(rgbaToInt(r, g, b, a), x, y);
          } else {
            canvas.setPixelColor(0x00000000, x, y);
          }
        }
      }
      return canvas;
    }

    // Process each web icon
    for (const icon of icons) {
      console.log(`Generating ${icon.name} at size ${icon.size}x${icon.size}...`);
      const canvas = renderCircularIcon(icon.size);
      const outputPath = path.join(outputDir, icon.name);
      await canvas.write(outputPath);
      console.log(`Saved ${icon.name} successfully!`);
    }

    // Android launcher icons
    // ponytail: single icon generator reuses the Jimp pipeline; ceiling = manual density buckets (no adaptive icons), upgrade path = adaptive icons in Phase 12 store material.
    const androidIcons = [
      { density: 'mipmap-mdpi', size: 48 },
      { density: 'mipmap-hdpi', size: 72 },
      { density: 'mipmap-xhdpi', size: 96 },
      { density: 'mipmap-xxhdpi', size: 144 },
      { density: 'mipmap-xxxhdpi', size: 192 },
    ];
    for (const icon of androidIcons) {
      const dir = `android/app/src/main/res/${icon.density}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      console.log(`Generating Android ${icon.density}/ic_launcher.png at ${icon.size}x${icon.size}...`);
      const canvas = renderCircularIcon(icon.size);
      await canvas.write(path.join(dir, 'ic_launcher.png'));
      console.log(`Saved ${icon.density}/ic_launcher.png successfully!`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

main();
