# Code Review

---

## 🔴 CRITICAL ISSUES (Must fix before deployment)
*Security breaches, data leaks, authorization bypasses, and production-breaking defects.*

---

## 🟡 WARNINGS (Highly recommended to address)
*UX failures, data integrity issues, scalability issues, and technical debt.*

### 4. No Current Password Required to Change Password
- **Location:** `server/api/users/me.put.ts:23,62-64`
- **Issue:** The `password` field in the update body is hashed and saved with no verification of the current password. An attacker with a stolen session token (valid for 7 days with no revocation mechanism) can silently change the victim's password, permanently locking them out.
- **Fix:** Add a `currentPassword` field to `updateProfileSchema` (required when `password` is provided), fetch the existing hash, and `compare()` before allowing the change:
  ```ts
  // In me.put.ts — add before the hash call at line 62
  if (password) {
    if (!currentPassword) {
      throw createError({ statusCode: 400, statusMessage: 'Current password is required to set a new password' });
    }
    const isMatch = await compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw createError({ statusCode: 403, statusMessage: 'Current password is incorrect' });
    }
    newPasswordHash = await hash(password, BCRYPT_COST_FACTOR);
  }
  ```
  Update `updateProfileSchema` in `validation.ts` to add `currentPassword: z.string().min(1).optional()`.

### 5. `friend-data.get.ts` Fetches ALL Friend Logs, Filters in JavaScript
- **Location:** `server/api/social/friend-data.get.ts:45-51,65-80`
- **Issue:** Lines 65-68 fetch **all** habit logs for a friend from the database. The shared-habit filter (line 80) only runs in JavaScript after the full result set is loaded. Unshared log data crosses the DB boundary into memory. Additionally, `db.select()` on line 45 returns all habit columns including `sharedWith`, exposing other users' IDs.
- **Fix:** Filter logs at the DB level and add column projection to habits:
  ```ts
  // Replace lines 45-51 (habits query) with column projection:
  const habitIds = habits.map((h: any) => h.id);
 
  // Replace lines 65-80 (logs query) with DB-level filter:
  const logsConditions = [
    eq(habitLogs.ownerId, fId),
    inArray(habitLogs.habitId, habitIds),
    gte(habitLogs.date, startDateStr)
  ];
  if (endDateStr) {
    logsConditions.push(lte(habitLogs.date, endDateStr));
  }
  const logs = await db.select().from(habitLogs)
    .where(and(...logsConditions))
    .orderBy(desc(habitLogs.date));
  ```
  Also add column projection to the habits query to exclude `sharedWith`.

### 6. IP-Based Rate Limiting Bypassable via `X-Forwarded-For` Spoofing
- **Location:** `server/utils/rateLimit.ts:15`
- **Issue:** `getRequestIP(event, { xForwardedFor: true })` trusts the `X-Forwarded-For` header. Unless Cloudflare always strips/overwrites this before the worker, attackers can rotate their apparent IP per request and bypass the 50-request IP limit entirely.
- **Fix:** On Cloudflare Workers, use the `CF-Connecting-IP` header instead, which Cloudflare controls and cannot be spoofed:
  ```ts
  const ip = getHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown';
  ```

### 7. Rate Limit Check-Then-Increment Is Non-Atomic
- **Location:** `server/utils/rateLimit.ts:24-37`
- **Issue:** The pattern reads `count`, checks it, then writes `count + 1` in separate storage calls. Under concurrent burst requests, multiple requests read the same count before any write lands, allowing the 5-request limit to be exceeded.
- **Fix:** If using Cloudflare KV (eventually consistent), this is inherent and somewhat mitigated by KV's caching. For stronger protection, consider using Cloudflare Durable Objects or an atomic increment pattern. At minimum, document this as a known limitation.

### 8. No Rate Limiting on Sensitive Non-Auth Endpoints
- **Location:** Various API routes
- **Issue:** `checkRateLimit` is only on `auth/register.post.ts` and `auth/login.post.ts`. Unprotected:
  - `users/search.get.ts` — username enumeration via brute force
  - `friendships/index.ts POST` — spam friend requests
  - `sync/bulk.post.ts` — expensive bulk operations
  - `social/feed.get.ts` — complex LATERAL join queries
- **Fix:** Apply a general-purpose rate limiter middleware or add per-route rate limiting to the above endpoints.

### 9. JWT Tokens Cannot Be Revoked on Logout
- **Location:** `server/api/auth/logout.post.ts:4-6`
- **Issue:** Logout only deletes the cookie. JWTs are stateless — a captured token remains valid for up to 7 days. No server-side blacklist exists.
- **Fix:** For immediate mitigation, reduce JWT lifetime from 7 days to a shorter window (e.g., 1 hour) with aggressive sliding renewal. For full revocation, implement a server-side token blacklist in KV checked on each `requireAuth` call.

### 10. `zColor` Accepts Arbitrary 50-Character Strings — XSS Vector
- **Location:** `server/utils/schemaPrimitives.ts:6`
- **Issue:** `z.string().max(50)` has no format constraint. A color field could contain `"><script>alert(1)` (25 chars). If ever rendered in an HTML attribute or unescaped context, it's an injection vector.
- **Fix:**
  ```ts
  // schemaPrimitives.ts — replace line 6
  export const zColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/)
  ```

### 11. [RESOLVED] Pusher Calls Are Fire-and-Forget Without `.catch()`
- **Issue:** Every `pusher.trigger(...)` was not awaited and had no `.catch()`.
- **Resolution:** Resolved by removing Pusher entirely from the codebase.

### 12. friendships/index.ts GET Returns Full Friendship Records
- **Location:** `server/api/friendships/index.ts:18-39`
- **Issue:** `db.select().from(friendshipsTable)` returns all columns (both user IDs, timestamps, internal status, favorites). Exposes internal structure of every friendship to the client.
- **Fix:** Add column projection to return only what the client needs:
  ```ts
  const userFriendships = await db.select({
    id: friendshipsTable.id,
    initiatorId: friendshipsTable.initiatorId,
    receiverId: friendshipsTable.receiverId,
    status: friendshipsTable.status,
    initiatorFavorite: friendshipsTable.initiatorFavorite,
    receiverFavorite: friendshipsTable.receiverFavorite
  })
    .from(friendshipsTable)
    .where(or(eq(friendshipsTable.initiatorId, userId), eq(friendshipsTable.receiverId, userId)));
  ```

### 13. Route Param `id` Not Validated as UUID Before DB Query
- **Location:** `server/api/friendships/[id].ts:13`, `server/api/habits/[id].ts`, `server/api/buckets/[id].ts`
- **Issue:** Route parameters are passed directly to DB queries without validating UUID format. Malformed IDs cause raw Postgres errors (22P02 invalid_text_representation) rather than clean 400 responses.
- **Fix:** Add a UUID format check at the top of each handler:
  ```ts
  const id = getRouterParam(event, 'id');
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ID format' });
  }
  ```

### 14. `loginSchema.identifier` Has No Max Length
- **Location:** `server/utils/validation.ts:54`
- **Issue:** `z.string().min(1)` with no `.max()` allows a multi-megabyte identifier string to be sent to a Postgres `WHERE` clause.
- **Fix:**
  ```ts
  // validation.ts — replace line 54
  identifier: z.string().min(1).max(255),
  ```

### 15. `N+1` Queries in `UserService.deleteUser` Friendship Cleanup
- **Location:** `server/services/user.service.ts:27-29`
- **Issue:** For every friendship the user has, `cleanupFriendshipData` is called individually (5 DB queries each). A user with 50 friends triggers 250 queries in a single transaction.
- **Fix:** Refactor `cleanupFriendshipData` to accept an array of friend pairs and batch all operations.

### 16. `SyncService.getPaginatedDeltas` Uses 3 Separate Transactions
- **Location:** `server/services/sync.service.ts:242-358`
- **Issue:** Paginated sync uses 3 independent `db.transaction()` calls. Data can change between them, producing inconsistent snapshots (e.g., a bucket deleted between fetching IDs and details).
- **Fix:** Consolidate into a single transaction with `REPEATABLE READ` isolation, or document this as a known limitation of the eventually-consistent sync model.

### 17. Bcrypt Cost Factor Hardcoded in `me.put.ts`, Diverges from Constant
- **Location:** `server/api/users/me.put.ts:63`
- **Issue:** Uses `hash(password, 10)` instead of the shared `BCRYPT_COST_FACTOR` from `auth.ts`. If the constant changes, password updates will use a different cost factor.
- **Fix:**
  ```ts
  // me.put.ts — replace line 63
  import { BCRYPT_COST_FACTOR } from '~~/server/utils/auth';
  // ...
  newPasswordHash = await hash(password, BCRYPT_COST_FACTOR);
  ```

### 18. Broken Shared Bucket Sync - DEFERRED
- **Location:** `server/services/sync.service.ts`
- **Issue:** The sync engine doesn't fetch metadata for habits owned by friends, even if they are in a shared bucket.
- **Fix:** Expand sync queries to include habits where the user is an accepted bucket member.

### 19. Missing API for Accepting Shared Habits - DEFERRED
- **Location:** `server/services/bucket.service.ts`
- **Issue:** No endpoint exists for a user to accept a friend's habit invitation into their bucket.
- **Fix:** Create a member status update endpoint.

---

## 🔵 NITPICKS & BEST PRACTICES

### 20. `zDateString` Doesn't Validate Real Dates
- **Location:** `server/utils/schemaPrimitives.ts:7`
- **Issue:** `/^\d{4}-\d{2}-\d{2}$/` accepts `"2024-13-45"`.
- **Fix:** Add a refinement: `.refine(val => !isNaN(Date.parse(val)), { message: 'Invalid date' })`.

### 21. `DUMMY_HASH` Is Exported Publicly
- **Location:** `server/utils/auth.ts:5`
- **Issue:** Used for constant-time comparison on non-existent users (good practice), but `export` makes it importable elsewhere and visible in the module graph.
- **Fix:** Change to `const DUMMY_HASH = ...` (remove `export`). Ensure it's only used within `auth.ts`.

### 22. Missing Indexes on Heavily Queried Columns
- **Location:** `server/db/schema.ts`
- **Note:** These are fine for low user counts but will cause sequential scans at scale:
  - `habitLogs` — needs index on `(habitId)` or `(habitId, date)` (11+ query sites filter by `habitId`)
  - `friendships` — needs indexes on `initiatorId` and `receiverId` (every lookup is a seq scan)
  - `shareEvents` — needs index on `recipientId`
  - `sharedBucketMembers` — needs indexes on `bucketId` and `userId` (39+ references)

### 23. status Columns Are Untyped `text` — No DB-Level Constraint
- **Location:** `friendships.status`, `habitLogs.status`, `bucketLogs.status`, `sharedBucketMembers.status`, `bucketHabits.approvalStatus`
- **Note:** Any arbitrary string can be persisted. Consider Postgres enums or CHECK constraints for data integrity.

### 24. API Route Handlers Lack HTTP Method Guards
- **Location:** `bucketlogs/index.ts`, `buckets/index.ts`, `habits/index.ts`, `habitlogs/index.ts`, `friendships/index.ts`
- **Note:** Unsupported methods (PATCH, OPTIONS, etc.) silently return `undefined` / `200 OK`. Should return 405 Method Not Allowed.

### 25. SESSION_MAX_AGE_SECONDS and SESSION_EXPIRATION_JWT Are Semantically Duplicated
- **Location:** `server/utils/auth.ts:8-9`
- **Note:** Two constants represent 7 days in different formats. If one changes without the other, cookie and JWT lifetimes diverge. Derive one from the other.

### 26. CI Uses wrangler@latest — Unpinned Dependency
- **Location:** `.github/workflows/deploy.yml:33`
- **Note:** A breaking Wrangler release could silently break deployments. Pin to a specific version.

### 27. habitLogSchema.id Uses z.string() While All Other IDs Use z.string().uuid()
- **Location:** `server/utils/validation.ts:84`
- **Note:** Log IDs accept any arbitrary string from the client, while other IDs enforce UUID format. This is presumably intentional (composite IDs like `{habitId}_{date}`), but worth noting.

### 28. SocialNarratorService Throws on Malformed Date From DB
- **Location:** `server/services/social-narrator.service.ts:49,128,148`
- **Note:** `format(parseISO(log.date), 'MMM d')` throws `RangeError` on malformed dates. A single corrupt row crashes the entire feed. Wrap in try-catch.

### 29. viewport Disables User Zoom — Accessibility Violation
- **Location:** `nuxt.config.ts:62`
- **Note:** `maximum-scale=1, user-scalable=0` prevents zooming, violating WCAG 1.4.4. Remove these restrictions.

### 30. Dexie IndexedDB Shared Across All Users on Same Browser
- **Location:** `app/utils/db.ts:34`
- **Note:** Database name `HabitsSocialDB` is hardcoded. On logout, IndexedDB is not wiped. User A's data remains accessible via dev tools after User B logs in. Consider wiping on logout or namespacing per user.

### 31. SQL Performance (LATERAL join) - DEFERRED
- **Location:** `server/api/social/feed.get.ts`
- **Note:** Fine for small groups, but will bottleneck at scale.

### 32. Magic Strings for Defaults - DEFERRED
- **Location:** `server/utils/validation.ts`
- **Note:** Hardcoded hex colors and limits.
- **Fix:** Extract to a shared `constants.ts`.

---

## 📝 NOTES

### Payload Size Limits (By Design)
It is a deliberate architectural decision to omit application-layer payload size capping (such as custom stream wrappers to counteract memory exhaustion from massive bodies).
- Adding complex application-layer stream parsing to counteract memory exhaustion (OOM) introduces unnecessary abstraction overhead for a hobby project.
- If the application scales and requires robust DoS protection, we will solve it at the infrastructure layer by upgrading the Cloudflare WAF plan (Business/Enterprise) to utilize native `http.request.body.size` checks or regex-based header filtering.

### Habit-Level Privacy Policy (By Design)
It is a core architectural decision that **Sharing a Habit = Sharing all its Logs**. 
- The `shared_with` column on `habit_logs` is deprecated and intentionally ignored by the API layer.
- Visibility is controlled exclusively by the `habits.shared_with` array.
- **DO NOT FLAG** "Missing hl.shared_with checks" in future audits; authorization is intentionally centralized at the parent object for data integrity and simplicity.

### Local-First Timestamp Integrity (By Design)
The frontend manages its own `updatedAt` timestamps locally to maintain optimistic UI state and local-first reconciliation logic.
- **DO NOT SUGGEST** changing how the client handles these timestamps or replacing them with server-assigned values during local operations.
- The server's use of `CLOCK_TIMESTAMP()` is strictly for backend-side sync anchors and database reconciliation.

### Service-Layer Ownership Checks (By Design for Security)
The ownership checks in `HabitService.logHabit` and `BucketService.logBucket` (specifically the `where` clause in `onConflictDoUpdate`) are **not redundant**.
- The API layer only validates that the user owns the `habitId` or `bucketId`.
- Since the schemas allow client-provided log `id`s, an attacker could target an existing log ID belonging to another user.
- The service-layer check `where: eq(ownerId, userId)` provides critical defense-in-depth, ensuring that a user can never overwrite a log they do not own, even if they guess the ID.
- **DO NOT REMOVE** these checks as they are essential for zero-trust fail-safes against ID collision/hijacking attacks.

### CI Pipeline Test Step (Skipped Due to Timeouts)
The proposal to add a test step to the CI pipeline was skipped. Adding the test step caused the pipeline to hang due to test timeouts, despite the tests passing successfully during local development. Further investigation is required before this can be implemented.

### Habit Sharing with Pending Friendships (By Design)
It is a deliberate design decision to allow sharing habit data with users in `pending` friendship status. The friendship guard query intentionally filters by `['accepted', 'pending']` to support this behavior.

### Feed Look-Ahead Query Optimization (By Design)
It is a deliberate decision to stick with the current precise `OR` conditions for the weekly logs look-ahead in `server/api/social/feed.get.ts` to protect Node.js memory from loading large date ranges, despite the O(N) query expansion.
- **DO NOT FLAG** this query pattern in future audits unless database CPU usage becomes a proven bottleneck.

