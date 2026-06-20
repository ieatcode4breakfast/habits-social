import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const outputPublic = join(root, '.output', 'public');
const manifestPath = join(outputPublic, 'manifest.webmanifest');
const swPath = join(outputPublic, 'sw.js');
const pushSwPath = join(outputPublic, 'push-sw.js');
const expectedDescription = 'Track habits, build streaks, and stay accountable with friends.';

let failures = 0;
const fail = (msg) => { console.error('[FAIL]', msg); failures++; };
const pass = (msg) => console.log('[PASS]', msg);
const hasIcon = (icons, sizes, purpose) => icons.some((icon) =>
  icon?.sizes === sizes && icon?.purpose?.split(/\s+/).includes(purpose)
);

console.log('[verify:sw-build] Checking PWA build output...\n');

if (!existsSync(outputPublic)) {
  fail('.output/public/ directory not found. Run "npm run build" first.');
} else {
  pass('Build output directory exists');
}

if (!existsSync(manifestPath)) {
  fail('.output/public/manifest.webmanifest not found');
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];

    if (manifest.id === '/') pass('Manifest has stable id "/"');
    else fail('Manifest id must be "/"');

    if (manifest.description === expectedDescription) pass('Manifest has the expected description');
    else fail('Manifest description is missing or unexpected');

    if (manifest.start_url === '/?source=pwa') pass('Manifest start_url is unchanged');
    else fail('Manifest start_url must be "/?source=pwa"');

    if (manifest.scope === '/') pass('Manifest scope is "/"');
    else fail('Manifest scope must be "/"');

    if (hasIcon(icons, '192x192', 'any')) pass('Manifest declares a 192x192 icon');
    else fail('Manifest missing a 192x192 icon with purpose "any"');

    if (hasIcon(icons, '512x512', 'any')) pass('Manifest declares a 512x512 icon');
    else fail('Manifest missing a 512x512 icon with purpose "any"');

    if (hasIcon(icons, '512x512', 'maskable')) pass('Manifest declares a maskable icon');
    else fail('Manifest missing a 512x512 icon with purpose "maskable"');

    for (const icon of icons) {
      if (typeof icon?.src !== 'string') {
        fail('Manifest icon is missing a valid src');
        continue;
      }

      const iconPath = join(outputPublic, icon.src.split('?')[0].replace(/^[/\\]+/, ''));
      if (existsSync(iconPath)) pass(`Manifest icon exists: ${icon.src}`);
      else fail(`Manifest icon file not found: ${icon.src}`);
    }
  } catch (error) {
    fail(`manifest.webmanifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!existsSync(pushSwPath)) {
  fail('.output/public/push-sw.js not found');
} else {
  pass('push-sw.js exists in build output');

  const pushSwContent = readFileSync(pushSwPath, 'utf-8');
  if (pushSwContent.includes("data.type && data.type !== 'chat.message'")) {
    pass('push-sw.js uses type-aware notification tagging');
  } else {
    fail('push-sw.js missing type-aware notification tagging');
  }

  if (pushSwContent.includes('client.navigate(')) {
    pass('push-sw.js includes existing-client navigation');
  } else {
    fail('push-sw.js missing existing-client navigation');
  }
}

if (!existsSync(swPath)) {
  fail('.output/public/sw.js not found (generated service worker)');
} else {
  pass('Generated sw.js exists');

  const swContent = readFileSync(swPath, 'utf-8');
  if (swContent.includes("importScripts('/push-sw.js')") || swContent.includes('importScripts("./push-sw.js")')) {
    pass('sw.js imports push-sw.js via importScripts');
  } else if (swContent.includes('push-sw.js')) {
    pass('sw.js references push-sw.js (check exact path)');
  } else {
    fail('sw.js does not reference push-sw.js. Expected importScripts("/push-sw.js") or similar.');
  }
}

if (failures > 0) {
  console.error(`\n[FAIL] ${failures} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log('\n[PASS] All PWA build assertions passed.');
  process.exit(0);
}
