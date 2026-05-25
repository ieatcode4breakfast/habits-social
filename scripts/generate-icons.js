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

    // Process each icon
    for (const icon of icons) {
      console.log(`Generating ${icon.name} at size ${icon.size}x${icon.size}...`);
      
      const N = icon.size;
      // We want to recreate:
      // A white circle in the center of a transparent canvas.
      // An image inside the circle, scaled to 135% of the canvas size, offset by -17.5% in both x and y.
      
      // Let's create a blank transparent target image of size N x N
      const canvas = new Jimp({ width: N, height: N, color: 0x00000000 });

      // Calculate source crop/scale properties
      // Since SVG viewBox is 0 0 100 100, the white circle is centered with radius 50 (fits perfectly).
      // The image is at x=-17.5, y=-17.5 with width=135, height=135.
      // So the scaled image size is 1.35 * N, and offset is -0.175 * N.
      const scaledSize = Math.round(1.35 * N);
      const offset = Math.round(-0.175 * N);

      // Clone the source image and resize it to scaledSize x scaledSize
      const resizedSrc = sourceImage.clone().resize({ w: scaledSize, h: scaledSize });

      // Loop through each pixel of our N x N target canvas
      const halfN = N / 2;
      const radius = N / 2;

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          // Calculate distance from center of target canvas
          // Center is (N/2, N/2)
          const dx = (x + 0.5) - halfN;
          const dy = (y + 0.5) - halfN;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= radius) {
            // Inside the circular viewport!
            // Map target coordinates back to the resized source image coordinates.
            // Target (x, y) corresponds to resizedSrc at (x - offset, y - offset)
            const srcX = x - offset;
            const srcY = y - offset;

            let r = 255;
            let g = 255;
            let b = 255;
            let a = 255;

            // If the coordinates fall inside the resized source image, sample it
            if (srcX >= 0 && srcX < scaledSize && srcY >= 0 && srcY < scaledSize) {
              const hexColor = resizedSrc.getPixelColor(srcX, srcY);
              const rgba = intToRGBA(hexColor);
              
              // Blend the source image pixel over a solid white background
              const alpha = rgba.a / 255;
              r = Math.round(rgba.r * alpha + 255 * (1 - alpha));
              g = Math.round(rgba.g * alpha + 255 * (1 - alpha));
              b = Math.round(rgba.b * alpha + 255 * (1 - alpha));
              a = 255; // Opaque inside the white circle
            }

            canvas.setPixelColor(rgbaToInt(r, g, b, a), x, y);
          } else {
            // Outside the circle
            if (icon.maskable) {
              // For maskable icon, fill the background outside the circle too
              // Map to the source image just like inside the circle
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
              // Standard circular icon: transparent outside the circle
              canvas.setPixelColor(0x00000000, x, y);
            }
          }
        }
      }

      // Write the icon to the output directory
      const outputPath = path.join(outputDir, icon.name);
      await canvas.write(outputPath);
      console.log(`Saved ${icon.name} successfully!`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

main();
