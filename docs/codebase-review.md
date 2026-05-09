# Codebase Review

## 🔴 CRITICAL ISSUES (Must fix before deployment)

### 1. Severe N+1 Query and O(N) Complexity in Bucket Reevaluation
- **Location:** `server/utils/buckets.ts` (`reevaluateBucketLogs` and `syncSingleBucketLog`)
- **Explanation:** When a bucket's composition changes, `reevaluateBucketLogs` sequentially loops over every unique logged date in the habit's history, calling `syncSingleBucketLog`. Crucially, `syncSingleBucketLog` queries the database multiple times and ends by calling `recalculateBucketStreak`, which executes multiple queries of its own. If a user has a year of history (365 dates), this triggers thousands of sequential, blocking database queries on a single request, leading to massive memory spikes, database locking, and immediate API timeouts.
- **Fix:** 
  1. Add an optional `skipStreakRecalculation` parameter to `syncSingleBucketLog` so it doesn't recalculate streaks on every single iteration of the loop.
  2. Call `recalculateBucketStreak` exactly once at the very end of `reevaluateBucketLogs`.
  3. For the long-term, refactor the `for (const row of datesRes)` loop to resolve dates via a single bulk `INSERT ... ON CONFLICT DO UPDATE` query.

---

## 🟡 WARNINGS (Highly recommended to address)

### 1. Wildcard Injection (Regex/Pattern DoS Risk)
- **Location:** `server/api/users/search.get.ts`
- **Explanation:** The endpoint mitigates length but passes the input directly into a `LIKE/ILIKE` clause: `ilike(users.username, \`%${sanitizedUsername}%\`)`. While Drizzle's prepared statements prevent classic SQL injection, they do not escape `%` or `_` characters. A malicious user submitting an input like `%%%%%%%%%%%%%%%%%%%%%` forces PostgreSQL to perform a very expensive, unindexed regex-style full table scan, degrading database performance.
- **Fix:** Manually escape Postgres wildcard characters in the user string before inserting it into the `ILIKE` wrapper:
  ```typescript
  const safeString = sanitizedUsername.replace(/[%_]/g, '\\$&');
  ilike(users.username, `%${safeString}%`)
  ```

### 2. Loose Type Casts in Error Handling Degrade Resilience
- **Location:** `server/services/habit.service.ts`, `server/api/auth/register.post.ts`
- **Explanation:** Catch blocks are relying heavily on `catch (e: any) { if (e.code === '23505') ... }`. This strips TypeScript's safety mechanisms. If the underlying database driver updates its error shape, you lose the ability to properly detect unique constraint violations, resulting in users getting vague 500 errors instead of graceful 409 Conflicts.
- **Fix:** Use `catch (e: unknown)` and implement a type guard (e.g., `isPostgresError(e)`) to safely check for specific `.code` properties.

### 3. Missing Rate Limiting on Authentication Endpoints - DEFERRED
- **Location:** `server/api/auth/login.post.ts` & `server/api/auth/register.post.ts`
- **Explanation:** There is no application-level rate limiting on the authentication routes. While you've implemented an excellent defense against timing attacks (`await compare(password, DUMMY_HASH)`), your endpoints are currently exposed to credential stuffing, brute-forcing, and mass bot registrations.
- **Fix:** Implement a rate limiting middleware specifically for `/api/auth/*` routes, utilizing Redis or a similar fast-access store, to restrict the number of login/register attempts per IP or identifier within a standard rolling window (e.g., 5 attempts per 15 minutes).

### 4. Cartesian Product Risk in Sync Pagination Memory Overhead - DEFERRED
- **Location:** `server/services/sync.service.ts` (`getDeltas` & `getPaginatedDeltas`)
- **Explanation:** You correctly mitigated Cartesian product truncation in pagination by first querying `bucketIds` and then querying details. However, you perform an unfiltered `.leftJoin(bucketHabits)... .leftJoin(habitsTable)... .leftJoin(sharedBucketMembers)` when fetching the bucket details. If a user has a heavily populated bucket with many habits and multiple shared members, the resulting row count returned from PostgreSQL before aggregation will multiply aggressively (habits * members), causing heavy memory and bandwidth spikes on the Node process.
- **Fix:** Consider using PostgreSQL JSON aggregation functions (e.g., `json_agg()`) to group nested arrays at the database level, or fetch `sharedMembers` and `bucketHabits` in separate parallel queries using `inArray(..., bucketIds)` and stitch them together in memory.

---

## 🔵 NITPICKS & BEST PRACTICES (Optional polish)

### 1. "Magic Strings" for Default Values
- **Location:** `server/utils/validation.ts` and `server/api/habits/index.ts`
- **Explanation:** Default fallback values like the hex color `'#6366f1'` or the maximum habit limits (`30`) are hardcoded directly into your API routes and Zod schemas. If the design language changes, you will have to hunt down multiple occurrences.
- **Fix:** Extract these into a shared constants file (`utils/constants.ts`) as `DEFAULT_HABIT_COLOR` and `MAX_HABITS_PER_USER` so both the backend schemas and frontend UI can import the exact same source of truth.

### 2. Asynchronous Console Logging on Fire-and-Forget Promises
- **Location:** `app/composables/useHabitsApi.ts`
- **Explanation:** `sync().catch(err => console.error(...))` executes safely in the background, but if Nuxt runs this context on the server during SSR (unlikely but possible based on your wrapper), floating promises can cause memory leaks or unhandled rejections. 
- **Fix:** Ensure fire-and-forget triggers explicitly verify `import.meta.client` before execution.

### 3. Bypassing Type Safety in Nuxt Context - DEFERRED
- **Location:** `server/api/auth/login.post.ts` (and others)
- **Explanation:** `const useDB = (event.context as any).useDB || _useDB;` circumvents TypeScript. It functions perfectly but degrades developer experience and safety.
- **Fix:** Augment the Nitro `H3EventContext` type in a declaration file (`d.ts`) so you can remove the `any` cast and get full autocomplete for injected dependencies.

### 4. Hardcoded Security Cache-Control Headers - DEFERRED
- **Location:** `server/api/habitlogs/index.ts`
- **Explanation:** Setting `Cache-Control` to `no-cache, no-store...` manually in the handler is good practice for private data, but doing it inside individual route handlers is error-prone and easily forgotten for new endpoints.
- **Fix:** Move this logic into a server middleware (e.g., `server/middleware/securityHeaders.ts`) that applies strict cache-control headers globally to all `/api/*` endpoints to ensure sensitive JSON is never cached.

### 5. Hardcoded Magic Numbers for Cookies - DEFERRED
- **Location:** `server/api/auth/login.post.ts`
- **Explanation:** `maxAge: 60 * 60 * 24 * 7` (7 days) is hardcoded for the authentication cookie.
- **Fix:** Extract this into a shared constant (e.g., `AUTH_COOKIE_MAX_AGE_SECONDS`) so it can be imported both here and wherever your `jwt.sign` configuration lives. This guarantees that the cookie and the JWT naturally expire at the exact same time without relying on synchronized "magic numbers."