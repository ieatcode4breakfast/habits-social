 # Pre-Production Review

**Created At:** 2026-05-09T08:27:49Z  
**Completed At:** 2026-05-09T08:27:49Z

---

## 🟡 WARNINGS (Highly recommended to address)

### 1. Missing Rate Limiting on Authentication Endpoints - DEFERRED
- **Location:** `server/api/auth/login.post.ts` & `server/api/auth/register.post.ts`
- **Explanation:** There is no application-level rate limiting on the authentication routes. While you've implemented an excellent defense against timing attacks (`await compare(password, DUMMY_HASH)`), your endpoints are currently exposed to credential stuffing, brute-forcing, and mass bot registrations.
- **Fix:** Implement a rate limiting middleware specifically for `/api/auth/*` routes, utilizing Redis or a similar fast-access store, to restrict the number of login/register attempts per IP or identifier within a standard rolling window (e.g., 5 attempts per 15 minutes).

### 2. Cartesian Product Risk in Sync Pagination Memory Overhead - DEFERRED
- **Location:** `server/services/sync.service.ts` (`getDeltas` & `getPaginatedDeltas`)
- **Explanation:** You correctly mitigated Cartesian product truncation in pagination by first querying `bucketIds` and then querying details. However, you perform an unfiltered `.leftJoin(bucketHabits)... .leftJoin(habitsTable)... .leftJoin(sharedBucketMembers)` when fetching the bucket details. If a user has a heavily populated bucket with many habits and multiple shared members, the resulting row count returned from PostgreSQL before aggregation will multiply aggressively (habits * members), causing heavy memory and bandwidth spikes on the Node process.
- **Fix:** Consider using PostgreSQL JSON aggregation functions (e.g., `json_agg()`) to group nested arrays at the database level, or fetch `sharedMembers` and `bucketHabits` in separate parallel queries using `inArray(..., bucketIds)` and stitch them together in memory.

---

## 🔵 NITPICKS & BEST PRACTICES (Optional polish)

### 1. Bypassing Type Safety in Nuxt Context - DEFERRED
- **Location:** `server/api/auth/login.post.ts` (and others)
- **Explanation:** `const useDB = (event.context as any).useDB || _useDB;` circumvents TypeScript. It functions perfectly but degrades developer experience and safety.
- **Fix:** Augment the Nitro `H3EventContext` type in a declaration file (`d.ts`) so you can remove the `any` cast and get full autocomplete for injected dependencies.

### 2. Hardcoded Security Cache-Control Headers - DEFERRED
- **Location:** `server/api/habitlogs/index.ts`
- **Explanation:** Setting `Cache-Control` to `no-cache, no-store...` manually in the handler is good practice for private data, but doing it inside individual route handlers is error-prone and easily forgotten for new endpoints.
- **Fix:** Move this logic into a server middleware (e.g., `server/middleware/securityHeaders.ts`) that applies strict cache-control headers globally to all `/api/*` endpoints to ensure sensitive JSON is never cached.

### 3. Hardcoded Magic Numbers for Cookies - DEFERRED
- **Location:** `server/api/auth/login.post.ts`
- **Explanation:** `maxAge: 60 * 60 * 24 * 7` (7 days) is hardcoded for the authentication cookie.
- **Fix:** Extract this into a shared constant (e.g., `AUTH_COOKIE_MAX_AGE_SECONDS`) so it can be imported both here and wherever your `jwt.sign` configuration lives. This guarantees that the cookie and the JWT naturally expire at the exact same time without relying on synchronized "magic numbers."
