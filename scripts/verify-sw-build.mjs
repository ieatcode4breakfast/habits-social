import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const outputPublic = join(root, '.output', 'public');
const swPath = join(outputPublic, 'sw.js');
const pushSwPath = join(outputPublic, 'push-sw.js');

let failures = 0;
const fail = (msg) => { console.error('[FAIL]', msg); failures++; };
const pass = (msg) => console.log('[PASS]', msg);

console.log('[verify:sw-build] Checking service worker build output...\n');

if (!existsSync(outputPublic)) {
  fail('.output/public/ directory not found. Run "npm run build" first.');
} else {
  pass('Build output directory exists');
}

if (!existsSync(pushSwPath)) {
  fail('.output/public/push-sw.js not found');
} else {
  pass('push-sw.js exists in build output');
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
  console.log('\n[PASS] All service worker build assertions passed.');
  process.exit(0);
}
