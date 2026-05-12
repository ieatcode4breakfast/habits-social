# Issue: Real-Time Sync Failure (Cloudflare Production Only)

## Status
**Date:** 2026-05-11  
**State:** Investigating (Implementation applied to Staging, but issue persists)  
**Priority:** Critical  

## Problem Description
Updates made on a primary device (Device 1) failed to trigger an automatic background pull on secondary devices (Device 2) when running in the Cloudflare Workers production environment. The issue was "deceptively simple" because it functioned perfectly in `localhost` but failed silently in deployment.

## Root Cause Analysis
The failure was traced to two primary factors:

### 1. Fire-and-Forget Pusher Triggers
The server-side `pusher.trigger` calls were not being `await`ed. In a serverless environment like Cloudflare Workers, the process can terminate as soon as the HTTP response is sent. If the Pusher broadcast hadn't finished, it was killed before the signal could be sent.

### 2. Distributed Clock Skew (The "Ghost" Data)
This was the most significant finding. The application was using inconsistent clock sources:
- **App Server (Cloudflare):** Used `new Date()` to set `updatedAt` for records.
- **Database (Neon):** Used `NOW()` to generate the sync anchor returned to the client.

If the Cloudflare clock was even a few milliseconds behind the Neon clock, a record saved at `12:00:00.450` would be "skipped" by a sync request asking for `updatedAt >= 12:00:00.500`. On `localhost`, where the clocks are the same, this never occurred.

## Implementation Details (Staging)

### Server-Side Fixes
- **Standardized Time:** All `updatedAt` updates in `HabitService`, `BucketService`, and `streaks.ts` now use `sql`now()` ` to ensure the record timestamp and sync anchor always share the same source (Database clock).
- **Enforced Waits:** All `pusher.trigger` calls are now `await`ed to guarantee survival in serverless workers.

### Client-Side Diagnostics
- **Pusher Signal Monitoring:** Added a console log in `app.vue` to track the reception of the `sync-settled` event: `[Realtime] Sync signal received: sync-settled`.

## Verification Status
> [!CAUTION]
> Despite standardizing the clocks and awaiting triggers, the issue remains unresolved in the staging environment as of the latest push. This suggests a deeper environmental or library-level failure beyond simple race conditions.

## Next Steps
1. **Verification:** Monitor the browser console on Device 2 for the `sync-settled` log message.
2. **Production Release:** Once confirmed, merge the `staging` branch into `main`.
