# Code Review

## 🔴 CRITICAL ISSUES (Must fix before deployment)

### 1. Broken Object Level Authorization (BOLA) in Friendship Deletion
- **Location:** `server/api/friendships/[id].ts` & `server/services/social.service.ts` (`removeFriendship`)
- **Explanation:** The API endpoint for deleting a friendship invokes `SocialService.removeFriendship` but completely fails to verify that the authenticated user (`userId`) is actually a participant in the friendship. Because `removeFriendship` only queries by `id`, any authenticated user can successfully send a `DELETE /api/friendships/<friendshipId>` request to destroy a friendship between any two arbitrary users.
- **Fix:** Update the initial query inside `SocialService.removeFriendship` to enforce ownership by requiring the user to be either the initiator or receiver: `db.select().from(friendshipsTable).where(and(eq(friendshipsTable.id, id), or(eq(friendshipsTable.initiatorId, userId), eq(friendshipsTable.receiverId, userId))))`.

### 2. Broken Offline-First Data Sync for Shared Buckets
- **Location:** `server/services/sync.service.ts` (`getDeltas` & `getPaginatedDeltas`)
- **Explanation:** The `sync.service.ts` correctly syncs the relationship mapping (`bucketHabits`) for shared buckets, but explicitly filters the actual `habits` and `habitLogs` payloads using `eq(habitsTable.ownerId, userId)`. This means clients receive the mapping that a friend's habit is in their bucket, but they never receive the foreign habit's title, metadata, or progress logs. The UI will inherently crash or fail to resolve the shared habit data locally.
- **Fix:** Update the `habits` and `habitLogs` queries in the sync engine to include records where the user is an accepted member of the parent bucket, rather than strictly filtering by `ownerId`.

### 3. Raw Account Deletion Bypasses Cascade Business Logic (Data Corruption)
- **Location:** `server/api/users/me.delete.ts`
- **Explanation:** The account deletion endpoint executes raw, direct `tx.delete()` operations across all tables (e.g., `bucketHabits`, `friendships`, `habits`). By bypassing `HabitService.deleteHabit` and `SocialService.removeFriendship`, it completely ignores the complex cascading logic required for a social application. If a user is part of a shared bucket or friendship, their sudden deletion leaves orphaned data, breaks streak recalculation for their friends' buckets, and fails to issue `syncDeletions` for connected clients.
- **Fix:** Refactor `me.delete.ts` to programmatically invoke the service layer for shared resources. You must trigger `reevaluateMultipleBuckets` for any foreign buckets the user interacted with before deleting their core records.

### 4. Missing API Endpoints for Accepting Shared Habits (Unreachable State)
- **Location:** `server/services/bucket.service.ts` & API Routes
- **Explanation:** When a user creates or updates a bucket to include a friend's habit, the backend correctly inserts those foreign habits into `bucketHabits` with `approvalStatus: 'pending'` and adds the friend to `sharedBucketMembers` with `status: 'pending'`. However, there are absolutely no API endpoints or service methods in the entire codebase that allow the friend to transition these records from `'pending'` to `'accepted'`. Because the sync engine filters out unaccepted items, the shared bucket feature is inherently inaccessible and broken by design.
- **Fix:** Create a new API route (e.g., `PUT /api/buckets/[id]/members/[userId]`) and a corresponding method that updates the member/habit status to `'accepted'` and triggers `reevaluateMultipleBuckets`.

---

## 🟡 WARNINGS (Highly recommended to address)

### 1. Implicit Authorization / Missing Service-Level Security Guardrails
- **Location:** `server/services/habit.service.ts` (`deleteHabit`) & `server/services/bucket.service.ts` (`deleteBucket`)
- **Explanation:** The service methods `deleteHabit` and `deleteBucket` directly delete rows based solely on the entity `id`. For example: `await tx.delete(habitsTable).where(eq(habitsTable.id, id));`. This is currently "safe" only because the API route controllers independently fetch the entity and verify ownership before invoking the service. However, relying on the controller layer for critical delete authorizations is a dangerous architectural pattern. If these service methods are later called from another context (e.g., bulk sync logic, internal cron jobs, or a GraphQL mutation), it will expose a BOLA vulnerability.
- **Fix:** Push the authorization check down to the database operation inside the service. Ensure that destruct operations intrinsically require the `ownerId`.

### 2. Incomplete Input Validation on Bulk Reorder Endpoint
- **Location:** `server/api/buckets/reorder.ts` & `server/api/habits/reorder.ts`
- **Explanation:** The `reorderSchema` uses `ids: z.array(z.string().uuid()).min(1)` to validate the incoming array of IDs for the `CASE WHEN` SQL update block. However, there is no maximum length enforced. An attacker or buggy client could submit an array of 50,000 UUIDs, generating an enormous dynamic SQL query that exceeds PostgreSQL's maximum statement size, tying up the connection pool, and causing a Denial of Service (DoS) on the database layer.
- **Fix:** Add a strict `.max(100)` limit to the `ids` array in the `reorderSchema` within `server/utils/validation.ts`.

### 3. Missing Rate Limiting on Authentication Endpoints - DEFERRED
- **Location:** `server/api/auth/login.post.ts` & `server/api/auth/register.post.ts`
- **Explanation:** There is no application-level rate limiting on the authentication routes. While you've implemented an excellent defense against timing attacks (`await compare(password, DUMMY_HASH)`), your endpoints are currently exposed to credential stuffing, brute-forcing, and mass bot registrations.
- **Fix:** Implement a rate limiting middleware specifically for `/api/auth/*` routes, utilizing Redis or a similar fast-access store, to restrict the number of login/register attempts per IP or identifier within a standard rolling window (e.g., 5 attempts per 15 minutes).

---

## 🔵 NITPICKS & BEST PRACTICES (Optional polish)

### 1. Inefficient `CROSS JOIN LATERAL` in Social Feed Query
- **Location:** `server/api/social/feed.get.ts`
- **Explanation:** The feed query uses a `CROSS JOIN LATERAL` over an unnested `friend_list` array to execute a complex `UNION ALL` subquery for each friend individually. While this creatively forces Postgres to utilize pagination indexes per user (Skip Scan), the inner block is executed `N` times (where `N` is the number of friends). If you ever scale the platform to allow hundreds or thousands of friends per user, this will severely bottleneck database performance and spike CPU usage.
- **Fix:** If the friend limit is capped to a small number (e.g., 50), this is acceptable. Otherwise, consider inverting the structure to `WHERE owner_id IN (...)` on the base tables, then applying `UNION ALL` across the results to allow the query planner to batch the fetch operation.

### 2. "Magic Strings" for Default Values - DEFERRED
- **Location:** `server/utils/validation.ts` and `server/api/habits/index.ts`
- **Explanation:** Default fallback values like the hex color `'#6366f1'` or the maximum habit limits (`30`) are hardcoded directly into your API routes and Zod schemas. If the design language changes, you will have to hunt down multiple occurrences.
- **Fix:** Extract these into a shared constants file (`utils/constants.ts`) as `DEFAULT_HABIT_COLOR` and `MAX_HABITS_PER_USER` so both the backend schemas and frontend UI can import the exact same source of truth.

### 3. Asynchronous Console Logging on Fire-and-Forget Promises - DEFERRED
- **Location:** `app/composables/useHabitsApi.ts`
- **Explanation:** `sync().catch(err => console.error(...))` executes safely in the background, but if Nuxt runs this context on the server during SSR (unlikely but possible based on your wrapper), floating promises can cause memory leaks or unhandled rejections. 
- **Fix:** Ensure fire-and-forget triggers explicitly verify `import.meta.client` before execution.

### 4. Bypassing Type Safety in Nuxt Context - DEFERRED
- **Location:** `server/api/auth/login.post.ts` (and others)
- **Explanation:** `const useDB = (event.context as any).useDB || _useDB;` circumvents TypeScript. It functions perfectly but degrades developer experience and safety.
- **Fix:** Augment the Nitro `H3EventContext` type in a declaration file (`d.ts`) so you can remove the `any` cast and get full autocomplete for injected dependencies.

### 5. Hardcoded Security Cache-Control Headers - DEFERRED
- **Location:** `server/api/habitlogs/index.ts`
- **Explanation:** Setting `Cache-Control` to `no-cache, no-store...` manually in the handler is good practice for private data, but doing it inside individual route handlers is error-prone and easily forgotten for new endpoints.
- **Fix:** Move this logic into a server middleware (e.g., `server/middleware/securityHeaders.ts`) that applies strict cache-control headers globally to all `/api/*` endpoints to ensure sensitive JSON is never cached.

### 6. Hardcoded Magic Numbers for Cookies - DEFERRED
- **Location:** `server/api/auth/login.post.ts`
- **Explanation:** `maxAge: 60 * 60 * 24 * 7` (7 days) is hardcoded for the authentication cookie.
- **Fix:** Extract this into a shared constant (e.g., `AUTH_COOKIE_MAX_AGE_SECONDS`) so it can be imported both here and wherever your `jwt.sign` configuration lives. This guarantees that the cookie and the JWT naturally expire at the exact same time without relying on synchronized "magic numbers."

### 7. Overwritten Where Clauses in Drizzle
- **Location:** `server/utils/streaks.ts`, inside `recalculateHabitStreak` - DEFERRED
- **Explanation:** The code calls `logsQuery.where(...)` and then optionally calls `logsQuery.where(...)` again if `queryStartDate` exists. In Drizzle ORM, subsequent `.where()` calls completely *overwrite* the previous clause rather than appending to it. While the code currently works because it manually re-declares the entire logical condition in the second call, it is highly fragile and confusing.
- **Fix:** Use Drizzle's `and()` to append conditions dynamically.

### 8. Limit Fallback Ignores Explicit Zeros - DEFERRED
- **Location:** `server/api/social/feed.get.ts`
- **Explanation:** `Number(query.limit) || 20` evaluates to `20` if `query.limit` is explicitly sent as `0`. If a valid UI use case ever involves fetching exactly `0` items (e.g., just checking for connectivity or headers), the API forces it to `20`.
- **Fix:** Use the nullish coalescing operator `??` or explicitly check for `undefined` if you want to permit `0`.
