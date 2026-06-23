/**
 * CORS preflight short-circuit for /api/** routes.
 *
 * Why this exists: Nitro's `routeRules: { cors: true }` injects the response-side
 * CORS headers but does NOT install an `OPTIONS` handler in the cloudflare-module
 * preset. Without this middleware, every cross-origin preflight returns the
 * route's own status (404 for unmatched OPTIONS, 401 for `requireAuth` routes)
 * and the browser blocks the actual request before it ever leaves the device.
 *
 * Symptom that this fixes: Android WebView login shows the generic
 * "Something went wrong." fallback (login.vue:257) because the preflight is
 * rejected and ofetch surfaces a response-less FetchError.
 *
 * ponytail: returns null to short-circuit the chain. Ceiling: relies on h3
 * treating `null` as a 200/empty response, which Chromium's CORS engine
 * accepts for preflight (any 2xx is permitted). Upgrade path: if a Nitro
 * preset ever serializes `null` as a non-2xx body, call setResponseStatus(204).
 */

import type { H3Event } from 'h3';

// ponytail: defineEventHandler / getMethod / setResponseHeader are Nitro
// auto-imports (h3 globals). Importing them by name from 'h3' would bypass the
// vi.stubGlobal shims used by server/tests/setup.ts, breaking the cors spec.

const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Habits-Client',
  'Access-Control-Max-Age': '86400',
};

// Read the request pathname defensively across h3 versions + the test mock event.
const getPathname = (event: H3Event): string => {
  const nodeReq = (event as unknown as { node?: { req?: { url?: string } } }).node?.req?.url;
  if (nodeReq) return nodeReq.split('?')[0];
  const path = (event as unknown as { path?: string }).path;
  return typeof path === 'string' ? path : '';
};

export default defineEventHandler(async (event: H3Event) => {
  if (getMethod(event) !== 'OPTIONS') return;
  if (!getPathname(event).startsWith('/api/')) return;

  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    setResponseHeader(event, name, value);
  }

  // Short-circuit: returning a non-undefined value stops downstream route
  // handlers (including requireAuth-based ones that would 401 on the preflight).
  return null;
});