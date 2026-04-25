# Habits Social: Deployment Post-Mortem & Migration Rationale

## Stack
- **Frontend**: Nuxt 4 (Vue)
- **Deployment**: Cloudflare Workers
- **Database (current)**: MongoDB Atlas

---

## Part 1: Identified Issues (Cloudflare Deployment vs. Local Runtime)

> [!IMPORTANT]
> **Core Observation**: When the **exact same set of actions** (register, log in, view habits, log out, log in as a different user) is performed on the **local `:3000` runtime connecting to the same live MongoDB Atlas database**, everything works perfectly. The moment those same actions are performed on the **Cloudflare Workers deployment**, they break in unpredictable ways.

> [!CAUTION]
> **This is not a list of all bugs.** These are only the issues identified so far. Every time a band-aid fix was applied and the deployment was re-tested, a new unrelated issue surfaced immediately. The codebase is **inherently unoptimized** for Cloudflare's serverless runtime. Fixing individual symptoms has proven ineffective — this is a systemic architectural mismatch.

---

### Issue 1: User Identity Leakage (Critical)
**Symptom**: After logging out of User A and logging in as User B, the dashboard displays User A's habits and data. The header correctly shows "Hi, User B!" but the data belongs to User A.

**Root Cause**: Cloudflare Workers reuse "isolates" (execution contexts) across requests. `callOnce(fetchUser)` in `app.vue` is treated as "once per isolate lifetime" — meaning the first user's identity is cached in memory. When a second user logs in on the same isolate, the identity check is skipped and the first user's state is served.

**Status**: Band-aid applied (removed `callOnce`). Full persistence of the fix under load is unverified.

---

### Issue 2: 30-Second Connection Hangs
**Symptom**: Logging in, loading the dashboard, or any database operation hangs for approximately 30 seconds before eventually succeeding or returning a 500 error.

**Root Cause**: The MongoDB Node.js driver was designed for long-lived server processes. It maintains a background connection pool (`minPoolSize`) to keep connections warm. Cloudflare Workers terminate all background activity the instant a request ends. On the next request, the driver finds its pooled connections dead, waits for the full `serverSelectionTimeoutMS` (30 seconds), then gives up or reconnects from scratch.

**Status**: Band-aid applied (set `minPoolSize: 0`). This reduces the hang but does not eliminate the fundamental reconnection overhead on every cold request.

---

### Issue 3: Stale Assets After Deployment
**Symptom**: After a new deployment is pushed, visiting the site shows a white screen or an older version of the UI. The only fix is manually clearing the browser cache.

**Root Cause**: Cloudflare and/or the browser caches the `index.html` entry point aggressively. When a new build is deployed, the HTML still references old JS/CSS chunk filenames. The old HTML is served from cache, pointing to files that no longer exist.

**Status**: Band-aid applied (`Cache-Control: no-cache` headers via `routeRules`). This should prevent future occurrences but does not self-heal for users already holding a stale cache.

---

### Issue 4: Missing Records (String vs. ObjectId Type Mismatch)
**Symptom**: Friend requests visible in the local runtime do not appear on the deployed site. The social page acts as if no records exist.

**Root Cause**: MongoDB stores `_id` fields as `ObjectId` types, but relational fields (like `initiatorId`, `receiverId`) may be stored as plain `String` depending on how they were inserted. The Node.js driver version and runtime context can behave differently when comparing types, causing queries that succeed locally to return empty results in the Workers environment.

**Status**: Band-aid applied (multi-type query matching both String and ObjectId). This is fragile and requires manual effort for every field.

---

### Issue 5: Environment Variable Injection Failures
**Symptom**: `MONGODB_URI` or `JWT_SECRET` is `undefined` at runtime despite being correctly set as Cloudflare secrets or in `.env`.

**Root Cause**: Nuxt's `useRuntimeConfig()` behaves differently in a Cloudflare Workers context. It requires the `event` object to be passed explicitly (`useRuntimeConfig(event)`) to correctly resolve secrets from the current request's environment binding. Without it, it falls back to build-time values which may be empty.

**Status**: Band-aid applied (explicitly passing `event` everywhere). Fragile — any new API handler that forgets this pattern will silently fail.

---

### Issue 6: Service Worker Redirect Crash
**Symptom**: Visiting the root URL (`/`) shows "This site can't be reached" (ERR_FAILED). Browser console shows: `The FetchEvent resulted in a network error response: a redirected response was used for a request whose redirect mode is not "follow"`.

**Root Cause**: A stale Service Worker (likely registered by a previous PWA build) intercepts the network request for `/`. When Nuxt's auth middleware issues a server-side redirect to `/login`, the Service Worker's fetch handler cannot handle the redirect and crashes, taking the entire page load with it.

**Status**: Band-aid applied (programmatically unregistering all Service Workers on mount). This only works *after* the page has successfully loaded at least once.

---

## Part 2: Why MongoDB is the Root of the Problem

All six issues above share a single common thread: **MongoDB's driver was built for stateful, long-running Node.js servers.** Cloudflare Workers are stateless and ephemeral. These two designs are fundamentally opposed.

MongoDB themselves acknowledge this — they built the "Data API" as an HTTP bridge specifically because their driver doesn't work in serverless environments. That API has since been **deprecated with no replacement**, signaling that MongoDB has no clear roadmap for serverless/edge compatibility.

Continuing to fight this stack means:
- Every new feature that touches the database risks triggering a new deployment-specific bug.
- Every fix requires deep knowledge of Cloudflare's runtime internals.
- There is no end state where the combination is "solid" — it is fundamentally held together by workarounds.

---

## Part 3: Recommended Migration — Neon (Serverless Postgres)

### What is Neon?
Neon is a **serverless Postgres** database. It was built from the ground up for stateless, ephemeral compute environments like Cloudflare Workers, Vercel Edge Functions, and AWS Lambda.

### Why Neon Solves Every Issue

| Issue | MongoDB (Current) | Neon |
|---|---|---|
| Connection Hangs | TCP pooling fights Workers' lifecycle | HTTP-based driver (`@neondatabase/serverless`), no persistent connections |
| State Leakage | Stateful driver + Workers isolate reuse | Stateless HTTP — no shared connection state possible |
| Type Mismatches | ObjectId vs String, inconsistent across runtimes | Standard SQL types, consistent everywhere |
| Env Variable Context | Requires `useRuntimeConfig(event)` workaround | Standard `process.env` / `event.context.cloudflare.env` — no special handling |
| Stale Assets | Unrelated to DB, but symptomatic of deployment instability | Deployment stability improves when the DB layer is solid |

### How Neon Works With Cloudflare Workers

```ts
// Before (MongoDB — fragile)
const db = await useDB(event); // TCP connection, pooling issues, timeouts
const habits = await db.collection('habits').find({ ownerid: userId }).toArray();

// After (Neon — clean)
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
const habits = await sql`SELECT * FROM habits WHERE ownerid = ${userId}`;
```

One import. No connection management. No pooling config. No timeouts. It just works.

### Migration Scope

| Layer | Change Required |
|---|---|
| Frontend (pages, components, composables) | **None** |
| Auth middleware | **None** |
| `server/utils/db.ts` | Replace MongoDB client with Neon client |
| `server/api/**` | Rewrite queries from MongoDB syntax to SQL (logic stays the same) |
| Database schema | Recreate `users`, `habits`, `habitlogs`, `friendships` as Postgres tables |
| Deployment config | Replace `MONGODB_URI` secret with `DATABASE_URL` (Neon connection string) |

### Setup Experience
1. Create a Neon project at [neon.tech](https://neon.tech) — free tier available.
2. Copy the connection string.
3. Add it as a Cloudflare secret (`DATABASE_URL`).
4. Deploy.

This is the "provide repo + env variables and it just works" experience — the same plug-and-play feeling from previous projects.

---

## Conclusion

The current stack (Nuxt + Cloudflare Workers + MongoDB) is not just buggy — it is architecturally mismatched at a fundamental level. The weekend lost fighting these issues is evidence of that mismatch, not a reflection of the app's complexity.

Migrating to **Neon** replaces the only broken piece of the stack while keeping everything else intact. The Cloudflare deployment, the Nuxt frontend, the API structure, the auth logic — all of it stays. Only the database driver and query syntax changes.

The result is a stack that is genuinely designed to work together: **Nuxt + Cloudflare Workers + Neon**.
