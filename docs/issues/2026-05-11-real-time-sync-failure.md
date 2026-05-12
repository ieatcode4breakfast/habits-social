# Issue: Real-Time Sync Failure (Cloudflare Production Only)

## Status
**Date:** 2026-05-12  
**State:** Resolved  
**Priority:** Critical  

## Problem Description
Real-time synchronization between devices worked perfectly on `localhost` but failed silently in the Cloudflare Workers production environment. Signals sent from Device 1 were never received by Device 2, resulting in stale UI states and "ghost" data.

## The Root Cause: "Credential Blindness"
The failure was not due to race conditions or clock skew, but rather a **silent initialization failure** of the Pusher service within the Cloudflare Worker.

### The Technical Breakdown:
1.  **Nitro Mapping Failure:** Nuxt's `useRuntimeConfig` fails to automatically map Cloudflare Worker environment variables (secrets) to the application configuration unless those secrets are prefixed with `NUXT_`.
2.  **Naming Mismatch:** The application expected `pusherSecret` (camelCase), but Cloudflare secrets are typically stored as `PUSHER_SECRET` (SCREAMING_SNAKE_CASE).
3.  **Silent Fail:** The `usePusher` utility returned `null` when it couldn't find the credentials, causing the application to skip all real-time triggers without throwing an error.

## The Resolution: Resilient Mapping
The fix involved refactoring the Pusher initialization to be "environment-aware." Instead of relying solely on Nuxt's configuration mapping, the utility now probes the native Cloudflare Worker context directly.

### The Code Fix (`server/utils/pusher.ts`):
```typescript
const cf = event?.context?.cloudflare;

const appId = config?.pusherAppId 
  || cf?.env?.PUSHER_APP_ID;

const key = config?.public?.pusherKey 
  || cf?.env?.PUSHER_KEY;

const secret = config?.pusherSecret 
  || cf?.env?.PUSHER_SECRET;

const cluster = config?.public?.pusherCluster 
  || cf?.env?.PUSHER_CLUSTER;
```

### Infrastructure Fix:
- Added `NUXT_PUBLIC_PUSHER_KEY` and `NUXT_PUBLIC_PUSHER_CLUSTER` to the Cloudflare environment variables to ensure the **Browser** (Client) also has access to the public keys at runtime, independent of the build-time configuration.

## Verification
> [!TIP]
> **SUCCESS:** With the resilient mapping in place, the Cloudflare Worker now successfully initializes Pusher using the native environment bindings. End-to-end sync is verified and functional.

## Lessons Learned
- **Don't Trust the Bridge:** Nuxt's `runtimeConfig` is a convenient bridge, but it is not a direct mirror of the Cloudflare environment. 
- **Native Fallbacks:** Always provide a fallback to `event.context.cloudflare.env` for critical infrastructure services (DB, Pusher, Redis) when running on Cloudflare Workers.
- **Public vs. Secret:** Remember that `publicRuntimeConfig` is baked at build-time. Use `NUXT_PUBLIC_` environment variables in Cloudflare to override these values at runtime for the browser.
