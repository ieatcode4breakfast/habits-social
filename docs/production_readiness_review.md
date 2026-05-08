# 🚀 PRODUCTION READINESS REVIEW — HabitsSocial

## 🔴 CRITICAL ISSUES (Must fix before deployment)

### 1. Pusher Realtime is Completely Non-Functional - FIXED
- **Files:** All `server/api/` route handlers
- **Explanation:** The V1 API (`server/_v1_archive/`) had Pusher server-side publishing in 36 locations across habit, bucket, habitlog, and social route handlers. These are all excluded from the Nitro build by `nuxt.config.ts` line 25: `ignore: ['api/_v1/**']`. The V2 route handlers (`server/api/`) contain zero imports of the Pusher server SDK and zero calls to `pusher.trigger()`. Meanwhile, the frontend composables `useRealtime.ts` and `useSocial.ts` subscribe to channels expecting events like `sync-settled`, `friend-request-received`, `habit-updated`, `bucket-updated`, etc. — events that will never be published.
- **Business Impact:** The realtime social feed, friend request notifications, live habit updates, and sync-settled triggers are all non-functional. The social feed relies on manual polling/refresh. Friend request notifications will never arrive until a manual page refresh.
- **Fix:** Reintroduce Pusher server-side publishing in the V2 handlers. At minimum: `sync-settled` events after habit/habitlog mutations, `friend-request-received`/`accepted` after friendship mutations, `habit-updated`/`deleted` after habit mutations, `bucket-updated`/`deleted` after bucket mutations.

---

### 2. User Account Deletion Leaves Orphaned Data - FIXED
- **File:** `server/api/users/me.delete.ts` (lines 13-18)
- **Explanation:** The DELETE handler only removes the row from the `users` table. The database schema (`server/db/schema.ts`) defines zero foreign key constraints (no `references()`, no `onDelete`, no `onUpdate`). This means deleting a user leaves behind orphaned habits, logs, buckets, friendships, and share events.
- **Business Impact:** GDPR/data privacy violation — user data is not fully deleted. Orphaned rows will accumulate, polluting friend feeds and slowing queries indefinitely.
- **Fix:** Before deleting the user, delete all related records across all tables in a transaction:
```typescript
// In order of dependency:
await db.delete(bucketLogs).where(eq(bucketLogs.ownerId, userId));
await db.delete(habitLogs).where(eq(habitLogs.ownerId, userId));
await db.delete(shareEvents).where(or(
  eq(shareEvents.ownerId, userId),
  eq(shareEvents.recipientId, userId)
));
await db.delete(syncDeletions).where(eq(syncDeletions.ownerId, userId));
await db.delete(sharedBucketMembers).where(eq(sharedBucketMembers.userId, userId));
await db.delete(bucketHabits).where(eq(bucketHabits.addedBy, userId));
await db.delete(buckets).where(eq(buckets.ownerId, userId));
await db.delete(habits).where(eq(habits.ownerId, userId));
await db.delete(friendships).where(or(
  eq(friendships.initiatorId, userId),
  eq(friendships.receiverId, userId)
));
await db.delete(users).where(eq(users.id, userId));
```

---

### 3. JWT Secret Fallback in Production - FIXED
- **File:** `server/utils/auth.ts` line 14, `nuxt.config.ts` line 41
- **Explanation:** `nuxt.config.ts` sets `jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev'`. The `auth.ts` `getSecret()` function check depends on `NODE_ENV` being set to 'production' in the Cloudflare environment. If the `JWT_SECRET` was never set via `wrangler secret put`, the app falls back to a hardcoded string public in the source code.
- **Business Impact:** Any attacker with source code access can forge valid authentication tokens for any user.
- **Fix:**
    - Remove the fallback string entirely. Always throw if the secret is missing.
    - Add `JWT_SECRET` to the `wrangler secret put` commands in the deploy workflow.
    - Remove the `|| 'fallback-secret-for-dev'` from `nuxt.config.ts`.

---

### 4. ILIKE-Based Uniqueness Enumeration Vulnerability - FIXED
- **File:** `server/api/auth/login.post.ts`, `server/api/auth/register.post.ts`, `server/api/users/me.put.ts`
- **Explanation:** Using `ILIKE` for uniqueness checks allows pattern-based attacks. A user with username `test` could be impersonated or enumerated by logging in with `test%` as the identifier.
- **Business Impact:** Account enumeration via wildcard behavior and potential for bypassing uniqueness constraints.
- **Fix:** Replace `ILIKE` with exact comparison using `eq()` (or `lower()` comparison) for user lookup and uniqueness checks.

---

### 5. Habit Logs DELETE Endpoint Doesn't Recalculate Streaks - FIXED
- **File:** `server/api/habitlogs/index.ts` (lines 103-129)
- **Explanation:** The DELETE handler removes a habit log but does not call `recalculateHabitStreak` or `syncBucketLogsForHabit`. Habit stats become stale and inconsistent.
- **Business Impact:** Inconsistent streak counts and bucket statuses after users clear or delete a habit log.
- **Fix:** Add the following calls after the DELETE operation:
```typescript
await recalculateHabitStreak(db, habitId, userId, dateStr);
await syncBucketLogsForHabit(db, habitId, userId, dateStr);
```

---

### 6. bcrypt-ts on Cloudflare Workers — CPU Timeout Risk - SKIP
- **File:** `server/api/auth/register.post.ts`, `server/api/auth/login.post.ts`
- **Explanation:** `bcrypt-ts` is a pure JavaScript implementation. On Cloudflare Workers free/bundled plans (10ms-50ms budget), hashing with 10 rounds takes ~40-80ms, risking request termination.
- **Business Impact:** Random 500 errors or timeouts during login and registration, especially under load.
- **Fix:** Either upgrade to Cloudflare Workers Unbound plan or replace `bcrypt-ts` with Web Crypto API's native `SubtleCrypto` (e.g., PBKDF2).

---

## ⚠️ WARNINGS (Highly recommended to address)

### 7. Multi-Step Mutations Lack Database Transactions
- **Affected Files:** `habits/[id].ts`, `buckets/[id].ts`, `friendships/[id].ts`, `buckets.ts`
- **Explanation:** Multiple sequential SQL writes are performed without `db.transaction()`. If an intermediate write fails, data enters an inconsistent state.
- **Fix:** Wrap multi-step mutations in `await db.transaction(async (tx) => { ... })`.

### 8. Password Truncation by bcrypt
- **File:** `server/utils/validation.ts`
- **Explanation:** bcrypt silently truncates input to 72 bytes. The current validation accepts up to 128 characters.
- **Fix:** Change validation to `z.string().min(8).max(72)`.

### 9. No Rate Limiting on Authentication & Search
- **Explanation:** No rate limiting exists at any layer.
- **Fix:** Implement Cloudflare WAF rate limiting or application-level middleware.

### 10. Login Identifier Wildcard Issue
- **File:** `server/api/auth/login.post.ts` (lines 31-32)
- **Explanation:** Using `ILIKE` for login allows pattern matching. If a user's username is john, an attacker could log in using JOHN (case-insensitive) or %ohn (wildcard).
- **Business Impact:** Ambiguous login behavior.
- **Fix:** Switch to exact comparison: use `eq(users.username, identifier.toLowerCase())`.

### 11. /api/sync Returns All Data on First Sync (60-Day Window)
- **File:** `server/api/sync.get.ts` (lines 43-48)
- **Explanation:** When `lastSynced` is 0, the habit/bucket log queries return up to 60 days of logs. ALL habits and buckets are returned regardless of date range.
- **Business Impact:** Initial sync for long-time users could time out or produce oversized responses.
- **Fix:** Implement pagination or incremental deltas only.

### 12. Legacy Log Purge on Every Sync Cycle
- **File:** `app/composables/useHabitsApi.ts` (lines 528-539)
- **Explanation:** On every sync cycle, the client scans ALL local logs to find "legacy" entries. O(n) scan runs repeatedly.
- **Business Impact:** UI jank during sync cycles for long-time users.
- **Fix:** Run the legacy purge only once on first login.

### 13. Double-Fetch on Pusher Events
- **File:** `app/composables/useSocial.ts` (lines 101-114)
- **Explanation:** When a Pusher event triggers, the code updates local state AND calls `refresh()`, resulting in two network round-trips.
- **Business Impact:** Twice the API requests for realtime social events.
- **Fix:** Trust the optimistic update and skip `refresh()`.

---

## 💡 NITPICKS & BEST PRACTICES (Optional polish)

### 14. Reorder Endpoints Use Sequential UPDATEs
- **Files:** `habits/reorder.ts`, `buckets/reorder.ts`
- **Explanation:** Both reorder endpoints perform N sequential UPDATE queries in a loop.
- **Fix:** Use a single bulk update using a `CASE` statement.

### 15. Global Cache-Control Applies to Static Assets
- **File:** `nuxt.config.ts` (lines 30-36)
- **Explanation:** `/**` rule applies to static assets, causing them to be re-fetched every page load.
- **Fix:** Add specific route rules for `/public/**` with long cache lifetimes.

### 16. nuxt.config.ts Typo in Comment
- **Line 45:** Comment says `pusherAppId` but actual key is `pusherAppId` (Corrected in documentation).

### 17. Logout Only Deletes Cookie — Token Remains Valid
- **File:** `server/api/auth/logout.post.ts`
- **Explanation:** Logout only deletes the cookie; the JWT remains valid for 7 days via headers.
- **Fix:** Implement a token blacklist.

### 18. Test Coverage Gaps
- **Explanation:** No E2E tests exist at `tests/e2e/`. Potential credential exposure in `.env` file.

### 19. sync.get.ts Line 28: notExists condition
- **Explanation:** `lastSynced > 0` ternary could produce undefined; should be made explicit.

---

## 📊 SUMMARY TABLE

| Severity | Count | Key Items |
| :--- | :--- | :--- |
| **🔴 CRITICAL** | 6 | Pusher non-functional, user deletion orphans data, JWT fallback, ILIKE enumeration, streak calculation bugs, bcrypt timeouts |
| **⚠️ WARNING** | 7 | Missing transactions, password truncation, no rate limiting, sync payload scaling, legacy purge O(n), double-fetch |
| **💡 NITPICK** | 6 | Sequential updates, static asset caching, logout token persistence, test coverage gaps |

**CONCLUSION:** The codebase is **NOT safe** for production deployment. These issues must be addressed before deployment.
