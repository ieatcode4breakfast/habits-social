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

## The Final Fix: Request-Scoped Instances

While switching to HTTP mode reduced the likelihood of I/O errors, the **module-level singleton** was still problematic because the `Pool` or `neon()` client instances could still inadvertently capture execution context from the first request that initialized them.

### Change: `server/utils/db.ts`

The implementation now uses **Request-Scoped Caching** via the Nitro `H3Event` context:

```ts
export const useDB = (event?: H3Event) => {
  // 1. Request-scoped cache (Isolated per-request)
  if (event?.context?._db) return event.context._db;

  // 2. Global singleton fallback (Tests or background startup)
  if (!event && cachedDb) return cachedDb;

  // ... (Configuration logic)

  let db: any;
  const isProduction = process.env.NODE_ENV === 'production' || !!cf;

  if (isProduction) {
    // Stateless HTTP mode for Production/Workers
    const sqlClient = neon(uri);
    db = drizzleHttp(sqlClient, { schema });
  } else {
    // Stateful Pool mode for Development/Tests
    if (!cachedPool) {
      cachedPool = new Pool({ connectionString: uri });
    }
    db = drizzle(cachedPool, { schema });
  }

  // Cache in the current request context
  if (event) event.context._db = db;
  
  return db;
};
```

### Why This Is The Correct Solution

1.  **True Isolation**: Each incoming HTTP request creates its own `neon()` client instance. This ensures that the `fetch()` calls are perfectly bound to the **current** request's I/O context.
2.  **No Race Conditions**: Concurrent requests (e.g., `me.get` and `sync.get` firing at once) no longer fight over a shared global instance.
3.  **Fallback Support**: The global singleton remains as a fallback for unit tests and startup hooks where an `H3Event` is not present, maintaining compatibility with the existing test runner.

---

## Performance Optimization

Alongside the I/O fix, the `SyncService.getPaginatedDeltas` was optimized to reduce database round-trips:

| Feature | Before | After | Improvement |
|---------|--------|-------|-------------|
| **Round-trips** | 4 separate calls | 2 batched calls | ~50% Latency Reduction |
| **Transaction Logic** | Multiple transactions | Single unified transaction | Improved consistency |
| **Batching** | Sequential awaits | `Promise.all` in `tx` | Native Neon HTTP batching |

---

## Verification

- **All 165 tests pass** (including 4 new request-scope isolation tests).
- **Manual Verification**: Rapid refreshing of the dashboard no longer triggers Cloudflare I/O exceptions.
- **Observability**: Cloudflare "Wall Time" for `/api/sync` has decreased significantly due to query batching.

---

## How It Affects the Database

We have moved from a stateful connection pool to a **stateless HTTP pipeline**. Neon's HTTP endpoint is designed exactly for this: it handles connection pooling on the server-side, so the client-side `fetch()` remains light and perfectly suited for the ephemeral nature of Cloudflare Workers.
