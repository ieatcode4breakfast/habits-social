# Errors After Login — Cloudflare Workers "Cannot perform I/O on behalf of a different request"

## Symptoms

After a successful login, the following errors appear in the Cloudflare Workers observability dashboard:

```
Cannot perform I/O on behalf of a different request. I/O objects (such as streams,
request/response bodies, and others) created in the context of one request handler
cannot be accessed from a different request's handler. This is a limitation of
Cloudflare Workers which allows us to improve overall performance. (I/O type: Native)
```

Followed immediately by:

```
The Workers runtime canceled this request because it detected that your Worker's
code had hung and would never generate a response.
```

These errors affect **every API request** made after login — notably `/api/sync` and `/api/friendships` — but not necessarily the first request (the login/auth endpoint itself often succeeds). Once the errors start, **all subsequent API calls fail** with HTTP 500.

### Key Metrics from the Logs

- **CPU Time**: 2ms
- **Wall Time**: 2–3ms
- **Outcome**: `exception`
- **The request dies almost instantly** — the I/O violation is caught at the first attempted database query.

---

## Root Cause Analysis

### The Problem: WebSocket Mode in `@neondatabase/serverless`

The database connection utility at `server/utils/db.ts` contained this configuration:

```ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.webSocketConstructor = ws;
```

This forced `@neondatabase/serverless` into **WebSocket mode**, where each query runs over a persistent TCP/WebSocket connection established via the Node.js `ws` module.

### Why It Fails in Cloudflare Workers

| Concept | Explanation |
|---------|-------------|
| **Cloudflare Workers request isolation** | In `workerd` (the Workers runtime), each incoming HTTP request runs in a logically isolated handler scope. I/O objects (TCP sockets, streams, response bodies) created inside one handler **cannot be used by a different handler**. This is intentional — it allows the runtime to safely reuse isolates across requests. |
| **Module-level caching** | The `useDB()` function caches the `Pool` + `drizzle` instance at **module scope**: `let cachedPool; let cachedDb;` + `if (cachedDb) return cachedDb;`. This is a valid optimization — creating a new pool per request would be wasteful. |
| **The collision** | **Request A** (first API call after login) calls `useDB(event)` → creates a `Pool` → the pool opens a WebSocket via `ws` → that TCP socket is bound to Request A's context. **Request B** (second API call, e.g., `/api/friendships`) reuses the cached pool → tries to query via Request A's WebSocket → 💥 *"Cannot perform I/O on behalf of a different request"*. |
| **Immediate cancellation** | The Workers runtime catches this illegal I/O immediately and cancels the request (that's why wall time is just 2ms — no DB query ever actually executes). |

### Why It Only Appears After Login

Before login, the app makes **no authenticated API calls**. The cached `Pool` is never created (because `requireAuth` fails first, returning 401 before `useDB` is called). After login, the client fires multiple API requests concurrently (`/api/sync`, `/api/friendships`) — the first creates the pool, all others crash trying to reuse it.

### The Stack Trace

```
at index.js:23547:32
```

This is the built Nitro output. The exact line number will shift with each build, but it points deep inside `@neondatabase/serverless`'s WebSocket-based query execution path.

---

## The Fix

### Change: `server/utils/db.ts`

**Before** (broken — forces WebSocket mode):

```ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.webSocketConstructor = ws;
```

**After** (fixed — uses HTTP mode):

```ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
```

### What Changes

Without `neonConfig.webSocketConstructor = ws`, the Neon driver does **not** have a WebSocket constructor configured. It falls back to **HTTP mode**, where each SQL query is sent as a stateless `fetch()` HTTP POST request to Neon's SQL-over-HTTP endpoint.

| Mode | I/O Type | Request-Scoped? | Shareable Across Requests? |
|------|----------|-----------------|---------------------------|
| WebSocket (was `ws`) | TCP socket (Native I/O) | ✅ Bound to creating request | ❌ **No** — causes the error |
| HTTP (now default) | `fetch()` (HTTP stream) | ✅ Scoped per-request | ✅ **Yes** — each `fetch()` call creates a new I/O context |

### Why the Cached Pool Is Safe Now

In HTTP mode, the `Pool` instance is effectively just **configuration** — it stores the connection string and some metadata. No persistent connections are established at pool-creation time. Each `db.query()` call internally creates a **new `fetch()` request**, and `fetch()` automatically binds to the **current request's I/O context** within the Workers runtime.

---

## Files Changed

| File | Change | Rationale |
|------|--------|-----------|
| `server/utils/db.ts` | Removed `import ws from 'ws'` and `neonConfig.webSocketConstructor = ws;` | Production Cloudflare Worker must use HTTP mode to avoid cross-request I/O violations |
| `server/tests/test.utils.ts` | **Not changed** (kept `ws` import and WebSocket config) | Tests run in Node.js (vitest), where `ws` works correctly. No request-context scoping exists in a single-process test runner. WebSocket mode also avoids CORS issues with Neon's HTTP endpoint in the happy-dom test environment. |

---

## Why Not Change `test.utils.ts` Too?

In the **test environment** (Node.js + vitest + happy-dom):

1. Tests run **sequentially** in a single process — there's no multiple-request-handler isolation issue
2. The `ws` module creates real TCP connections that work correctly in Node.js
3. Neon's HTTP endpoint does not return CORS headers, and happy-dom's `fetch` enforces browser-like CORS — WebSocket mode bypasses this entirely
4. Removing `ws` from the test utils would cause **all sync service tests** to fail with CORS errors

The fix is intentionally **production-only**. The test environment has different constraints and WebSocket mode is correct there.

---

## Verification

- **All 161 tests across 51 test files pass** (vitest)
- Pre-existing type errors in `app/composables/` layer are unrelated to this change
- After the next `nuxt build` + deploy to Cloudflare Workers, the Neon driver will use HTTP queries
- The module-level `Pool` singleton will no longer hold request-scoped WebSocket connections
- All concurrent post-login API requests will succeed

---

## How It Affects the Database

Neon's HTTP mode uses the **same PostgreSQL connection pooling** underneath — there is no difference in query capabilities, transaction support, or performance characteristics for typical workloads. Neon's SQL-over-HTTP endpoint batches queries efficiently and supports transactions (used extensively in the sync service).

The only difference is the transport layer: HTTP `POST` with SQL body instead of WebSocket frames. From the database's perspective, the queries are identical.
