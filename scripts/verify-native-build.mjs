import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const outputPublic = join(root, '.output', 'public');

let failures = 0;
const fail = (msg) => { console.error('[FAIL]', msg); failures++; };
const pass = (msg) => console.log('[PASS]', msg);

console.log('[verify:native-build] Checking native build output...\n');

// (a) index.html exists
const indexPath = join(outputPublic, 'index.html');
if (!existsSync(indexPath)) {
  fail('.output/public/index.html not found — build may have failed');
} else {
  pass('index.html exists in build output');
}

// (b) sw.js does NOT exist
const swPath = join(outputPublic, 'sw.js');
if (existsSync(swPath)) {
  fail('sw.js should not exist in native build (PWA disabled)');
} else {
  pass('sw.js correctly absent (PWA disabled)');
}

// (c) manifest.webmanifest does NOT exist
const manifestPath = join(outputPublic, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
  fail('manifest.webmanifest should not exist in native build (PWA disabled)');
} else {
  pass('manifest.webmanifest correctly absent (PWA disabled)');
}

// Read index.html content once for checks (d)(e)(f)(h)
let html = '';
if (existsSync(indexPath)) {
  try {
    html = readFileSync(indexPath, 'utf-8');
  } catch (err) {
    fail(`Could not read index.html: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// (d) index.html does not reference push-sw.js
if (html) {
  if (html.includes('push-sw.js')) {
    fail('index.html must not reference push-sw.js in native build');
  } else {
    pass('index.html does not reference push-sw.js');
  }
}

// (e) index.html must not contain Google Identity markers
const googleMarkers = ['accounts.google.com', 'gsi/', 'accounts.google.com/gsi/client', 'client_id'];
if (html) {
  let googleFailures = 0;
  for (const marker of googleMarkers) {
    if (html.includes(marker)) {
      fail(`index.html contains Google Identity marker: "${marker}"`);
      googleFailures++;
    }
  }
  if (googleFailures === 0) {
    pass('index.html contains no Google Identity markers');
  }
}

// (f) CSP meta tag includes production hosts
if (html) {
  let cspFailures = 0;

  if (!html.includes('Content-Security-Policy')) {
    fail('index.html is missing Content-Security-Policy meta tag');
    cspFailures++;
  }

  // Assert BOTH protocol-prefixed forms present in CSP — bare host-count is insufficient
  // (would falsely pass if CSP emitted https://host twice with wss://host missing).
  const host = 'habits-social-realtime-production.ieatcode4breakfast.partykit.dev';
  if (!html.includes(`https://${host}`)) {
    fail(`CSP must include "https://${host}" (connect-src https form)`);
    cspFailures++;
  }
  if (!html.includes(`wss://${host}`)) {
    fail(`CSP must include "wss://${host}" (connect-src wss form)`);
    cspFailures++;
  }

  const apiHost = 'https://www.habitssocial.com';
  if (!html.includes(apiHost)) {
    fail(`CSP or payload must include "${apiHost}"`);
    cspFailures++;
  }

  if (cspFailures === 0) {
    pass('CSP meta tag includes production hosts (https://www.habitssocial.com + PartyKit https/wss)');
  }
}

// (g) .output/server/index.mjs does NOT exist (static preset)
const serverEntry = join(root, '.output', 'server', 'index.mjs');
if (existsSync(serverEntry)) {
  fail('.output/server/index.mjs should not exist (static preset; no server bundle)');
} else {
  pass('.output/server/index.mjs correctly absent (static preset)');
}

// (h) index.html includes the apiBaseUrl in the Nuxt payload
if (html) {
  if (html.includes('https://www.habitssocial.com')) {
    const cspIndex = html.indexOf('Content-Security-Policy');
    const payloadIndex = html.indexOf('https://www.habitssocial.com', cspIndex !== -1 ? cspIndex + 30 : 0);
    const inPayload = payloadIndex !== -1 && (cspIndex === -1 || payloadIndex > cspIndex + 200);
    pass(`index.html includes apiBaseUrl "https://www.habitssocial.com"${inPayload ? ' (confirmed in script payload)' : ''}`);
  } else {
    fail('index.html must include apiBaseUrl "https://www.habitssocial.com" in the build payload');
  }
}

// (i) No help-center content bundled
const helpCenterHtml = join(outputPublic, 'help-center', 'welcome.html');
const helpCenterIndexHtml = join(outputPublic, 'help-center', 'welcome', 'index.html');
if (existsSync(helpCenterHtml)) {
  fail('Help-center content (help-center/welcome.html) should not be bundled in native build');
} else if (existsSync(helpCenterIndexHtml)) {
  fail('Help-center content (help-center/welcome/index.html) should not be bundled in native build');
} else {
  pass('No help-center content bundled in native build');
}

if (failures > 0) {
  console.error(`\n[FAIL] ${failures} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log('\n[PASS] All native build assertions passed.');
  process.exit(0);
}
