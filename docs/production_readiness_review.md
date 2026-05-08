# 🚀 PRODUCTION READINESS REVIEW — HabitsSocial

## 🔴 CRITICAL ISSUES (Must fix before deployment)

### 1. Pusher Realtime is Completely Non-Functional
- **Files:** All `server/api/` route handlers
- **Explanation:** The V1 API (`server/_v1_archive/`) had Pusher server-side publishing in 36 locations across habit, bucket, habitlog, and social route handlers. These are all excluded from the Nitro build by `nuxt.config.ts` line 25: `ignore: ['api/_v1/**']`. The V2 route handlers (`server/api/`) contain zero imports of the Pusher server SDK and zero calls to `pusher.trigger()`. Meanwhile, the frontend composables `useRealtime.ts` and `useSocial.ts` subscribe to channels expecting events like `sync-settled`, `friend-request-received`, `habit-updated`, `bucket-updated`, etc. — events that will never be published.
- **Business Impact:** The realtime social feed, friend request notifications, live habit updates, and sync-settled triggers are all non-functional. The social feed relies on manual polling/refresh. Friend request notifications will never arrive until a manual page refresh.
- **Fix:** Reintroduce Pusher server-side publishing in the V2 handlers. At minimum: `sync-settled` events after habit/habitlog mutations, `friend-request-received`/`accepted` after friendship mutations, `habit-updated`/`deleted` after habit mutations, `bucket-updated`/`deleted` after bucket mutations.

---

### 2. User Account Deletion Leaves Orphaned Data
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

### 3. JWT Secret Fallback in Production
- **File:** `server/utils/auth.ts` line 14, `nuxt.config.ts` line 41
- **Explanation:** `nuxt.config.ts` sets `jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev'`. The `auth.ts` `getSecret()` function check depends on `NODE_ENV` being set to 'production' in the Cloudflare environment. If the `JWT_SECRET` was never set via `wrangler secret put`, the app falls back to a hardcoded string public in the source code.
- **Business Impact:** Any attacker with source code access can forge valid authentication tokens for any user.
- **Fix:**
    - Remove the fallback string entirely. Always throw if the secret is missing.
    - Add `JWT_SECRET` to the `wrangler secret put` commands in the deploy workflow.
    - Remove the `|| 'fallback-secret-for-dev'` from `nuxt.config.ts`.

---

### 4. ILIKE-Based Uniqueness Enumeration Vulnerability
- **File:** `server/api/auth/login.post.ts`, `server/api/auth/register.post.ts`, `server/api/users/me.put.ts`
- **Explanation:** Using `ILIKE` for uniqueness checks allows pattern-based attacks. A user with username `test` could be impersonated or enumerated by logging in with `test%` as the identifier.
- **Business Impact:** Account enumeration via wildcard behavior and potential for bypassing uniqueness constraints.
- **Fix:** Replace `ILIKE` with exact comparison using `eq()` (or `lower()` comparison) for user lookup and uniqueness checks.

---

### 5. Habit Logs DELETE Endpoint Doesn't Recalculate Streaks
- **File:** `server/api/habitlogs/index.ts` (lines 103-129)
- **Explanation:** The DELETE handler removes a habit log but does not call `recalculateHabitStreak` or `syncBucketLogsForHabit`. Habit stats become stale and inconsistent.
- **Business Impact:** Inconsistent streak counts and bucket statuses after users clear or delete a habit log.
- **Fix:** Add the following calls after the DELETE operation:
```typescript
await recalculateHabitStreak(db, habitId, userId, dateStr);
await syncBucketLogsForHabit(db, habitId, userId, dateStr);
```

---

### 6. bcrypt-ts on Cloudflare Workers — CPU Timeout Risk
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

---

## 📊 SUMMARY TABLE

| Severity | Count | Key Items |
| :--- | :--- | :--- |
| **🔴 CRITICAL** | 6 | Pusher non-functional, user deletion orphans data, JWT fallback, ILIKE enumeration, streak calculation bugs, bcrypt timeouts |
| **⚠️ WARNING** | 7 | Missing transactions, password truncation (72-byte limit), no rate limiting, sync payload scaling issues |
| **💡 NITPICK** | 6 | Sequential reorder updates, static asset caching, logout token persistence |

**CONCLUSION:** The codebase is **NOT safe** for production deployment. The issues identified above must be addressed to ensure security, data integrity, and functional parity.
