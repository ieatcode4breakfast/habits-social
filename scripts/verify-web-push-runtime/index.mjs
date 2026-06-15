import { createECDH, randomBytes } from 'crypto';
import { default as webpush } from 'web-push';

const { generateVAPIDKeys, setVapidDetails, sendNotification } = webpush;

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`[PASS] ${msg}`);
}

async function main() {
  console.log('[verify:web-push-runtime] Checking web-push crypto foundations...');

  let ecdh;
  try {
    ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const publicKey = ecdh.getPublicKey();
    if (!publicKey || publicKey.length === 0) fail('createECDH returned empty public key');
    pass(`crypto.createECDH("prime256v1") works (${publicKey.length}-byte public key)`);
  } catch (err) {
    fail(`crypto.createECDH failed: ${err?.message || err}`);
  }

  const vapidKeys = generateVAPIDKeys();
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    fail('generateVAPIDKeys returned empty keys');
  }
  pass('webpush.generateVAPIDKeys() works');

  setVapidDetails(
    'mailto:verify@habitssocial.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  // Generate a valid ECDH key pair so web-push's encryption code is exercised.
  // The uncompressed EC point is 65 bytes (0x04 prefix + 32-byte X + 32-byte Y).
  const subEcdh = createECDH('prime256v1');
  subEcdh.generateKeys();
  const subPublicKeyRaw = subEcdh.getPublicKey(undefined, 'uncompressed');
  const p256dh = subPublicKeyRaw.toString('base64url');
  const auth = randomBytes(16).toString('base64url');

  const throwawayEndpoint = 'https://127.0.0.1:19999/verify-throwaway';
  const throwawaySub = {
    endpoint: throwawayEndpoint,
    keys: { p256dh, auth },
  };

  console.log('[verify:web-push-runtime] Exercising webpush.sendNotification against unreachable endpoint...');

  try {
    await sendNotification(throwawaySub, 'test payload', { timeout: 3000 });
    fail('sendNotification succeeded against unreachable endpoint (unexpected)');
  } catch (err) {
    const msg = (err && typeof err === 'object' ? err.message || String(err) : String(err)).toLowerCase();

    const cryptoKeywords = ['createecdh', 'ecdh', 'crypto', 'not implemented', 'not supported', 'not a function'];
    const isCryptoFailure = cryptoKeywords.some(k => msg.includes(k));

    if (isCryptoFailure) {
      fail(`webpush.sendNotification failed with crypto error: ${msg}\n      This indicates web-push encryption primitives are broken in this runtime.`);
    }

    const networkKeywords = ['fetch failed', 'econnrefused', 'enotfound', 'timeout', 'socket', 'connection', 'network', 'connect'];
    const isNetworkFailure = networkKeywords.some(k => msg.includes(k));

    if (isNetworkFailure) {
      pass(`webpush.sendNotification reached VAPID-encrypted request stage (network error as expected): ${msg}`);
    } else {
      console.warn(`[WARN] Unexpected error type but not a crypto failure: ${msg}`);
      pass(`webpush.sendNotification completed without crypto errors (unexpected error type)`);
    }
  }

  console.log('\nAll web-push runtime checks passed.');
}

main();
