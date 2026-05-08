PRODUCTION READINESS REVIEW — HabitsSocial

CRITICAL ISSUES (Must fix before deployment)

1. Pusher Realtime is Completely Non-Functional
Files: All server/api/ route handlers
Explanation: The V1 API (server/_v1_archive/) had Pusher server-side publishing in 36 locations across habit, bucket, habitlog, and social route handlers. These are all excluded from the Nitro build by nuxt.config.ts line 25: ignore: ['api/_v1/**']. The V2 route handlers (server/api/) contain zero imports of the Pusher server SDK and zero calls to pusher.trigger(). Meanwhile, the frontend composables useRealtime.ts, useSocial.ts subscribe to channels expecting events like sync-settled, friend-request-received, habit-updated, bucket-updated, etc. — events that will never be published.
Business Impact: The realtime social feed, friend request notifications, live habit updates, and sync-settled triggers are all non-functional. The social feed relies on manual polling/refresh. Friend request notifications will never arrive until a manual page refresh.
Fix: Reintroduce Pusher server-side publishing in the V2 handlers. At minimum: sync-settled events after habit/habitlog mutations, friend-request-received/accepted after friendship mutations, habit-updated/deleted after habit mutations, bucket-updated/deleted after bucket mutations.

2. User Account Deletion Leaves Orphaned Data
File: server/api/users/me.delete.ts (lines 13-18)
Explanation: The DELETE handler only removes the row from the users table. The database schema (server/db/schema.ts) defines zero foreign key constraints (no references(), no onDelete, no onUpdate). This means deleting a user leaves behind:
- All their habits (habits table)
- All their habit logs (habit_logs)
- All their buckets and bucket-habit associations
- All friendships they're part of
- All share events
- All sync deletions records
Business Impact: GDPR/data privacy violation — user data is not fully deleted. Orphaned rows will accumulate, polluting friend feeds and slowing queries indefinitely. The API comment at line 14-15 even acknowledges this risk with "you might need cascading deletes configured in your DB."
Fix: Before deleting the user, delete all related records across all tables in a transaction:
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
await db.delete(bucketHabits).where(/* habits owned by user */);
await db.delete(buckets).where(eq(buckets.ownerId, userId));
await db.delete(habits).where(eq(habits.ownerId, userId));
await db.delete(friendships).where(or(
  eq(friendships.initiatorId, userId),
  eq(friendships.receiverId, userId)
));
await db.delete(users).where(eq(users.id, userId));

3. JWT Secret Fallback in Production
File: server/utils/auth.ts line 14, nuxt.config.ts line 41
Explanation: nuxt.config.ts sets jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev'. The auth.ts getSecret() function checks if (!secret && process.env.NODE_ENV === 'production') and throws an error. However, this check depends on NODE_ENV being set to 'production' in the Cloudflare environment. The wrangler.toml only sets NODE_ENV = "production" for the [env.production.vars] block and has a comment saying to use wrangler secret put. If the JWT_SECRET secret was never set via wrangler secret put (the deploy workflow doesn't include this step — it only teleports Pusher secrets, not JWT_SECRET), the app falls back to the hardcoded string. The error thrown by auth.ts would crash the request, but only if NODE_ENV happens to be set. On the staging environment where NODE_ENV is not set, the app silently uses 'fallback-secret-for-dev' which is public in the source code — any attacker can forge JWTs.
Business Impact: If JWT_SECRET is not properly set as a Cloudflare Worker secret on both staging and production, an attacker with source code access (the repo is public on GitHub) can forge valid authentication tokens for any user.
Fix:
- Remove the fallback string entirely. Always throw if the secret is missing, regardless of NODE_ENV.
- Add JWT_SECRET to the wrangler secret put commands in the deploy workflow (deploy.yml).
- Remove the || 'fallback-secret-for-dev' from nuxt.config.ts.

4. ILIKE-Based Uniqueness Enumeration Vulnerability
File: server/api/auth/login.post.ts (lines 31-32), server/api/auth/register.post.ts (lines 24-26), server/api/users/me.put.ts (lines 39, 52)
Explanation: Using ILIKE for uniqueness checks allows pattern-based attacks. In PostgreSQL, ILIKE 'test%' matches usernames starting with "test". While the registration endpoint returns a generic error (line 31: 'Email or username already taken'), the login endpoint reveals whether a match was found via response timing differences (lines 36-42: the dummy bcrypt compare fires only when no user is found, and the 400 response is distinct from the 401 that a wrong password produces — wait, actually both return 400. Let me re-read...
Actually, looking more carefully: lines 41 and 47 both throw statusCode: 400 with the exact same message 'Invalid username, email or password'. The timing attack mitigation at line 40 (dummy compare) is present. However, the ILIKE wildcard issue remains: a user with username test could be impersonated by logging in with test% as the identifier.
The bigger issue is in users/me.put.ts lines 38-41 and 48-52: the uniqueness check uses ILIKE, meaning a user could check if any username matches a pattern. This is data leakage.
Business Impact: Account enumeration via timing analysis of the ILIKE wildcard behavior, plus potential for bypassing uniqueness constraints.
Fix: Replace ILIKE with exact comparison using eq() (or lower() comparison) for user lookup and uniqueness checks. If case-insensitive matching is desired, add a lower() functional index on the column and use eq(lower(users.username), identifier.toLowerCase()).

5. habitlogs/index.ts DELETE Endpoint Doesn't Recalculate Streaks
File: server/api/habitlogs/index.ts (lines 103-129)
Explanation: The DELETE handler removes a habit log from the database but does not call recalculateHabitStreak(db, habitId, userId, dateStr) or syncBucketLogsForHabit(db, habitId, userId, dateStr). Compare with the POST handler at lines 97-98 which calls both. After deleting a log, the habit's currentStreak, longestStreak, and streakAnchorDate fields become stale. The bucket logs also become inconsistent since they are derived from habit logs.
Business Impact: Inconsistent streak counts and bucket statuses after users clear or delete a habit log. The habit detail view will show incorrect streak figures until another log operation triggers a recalculation.
Fix: Add after the DELETE at line 127:
await recalculateHabitStreak(db, habitId, userId, dateStr);
await syncBucketLogsForHabit(db, habitId, userId, dateStr);

6. bcrypt-ts on Cloudflare Workers — CPU Timeout Risk
File: server/api/auth/register.post.ts (line 34), server/api/auth/login.post.ts (line 40)
Explanation: bcrypt-ts is a pure JavaScript implementation of bcrypt (no native bindings). On Cloudflare Workers, each request has a CPU time budget (10ms on free plan, 50ms on paid "Bundled", 30s on "Unbound"). bcrypt hashing with salt rounds of 10 takes ~40-80ms in pure JS, which can exceed the CPU budget on the free/bundled Workers plans, causing requests to be terminated mid-execution. The login delay mitigation at line 40 also performs a bcrypt compare when the user is not found, doubling the CPU cost for invalid login attempts.
Business Impact: On the free/bundled Cloudflare Workers plans, login and registration requests may randomly fail with 500 errors or timeouts, especially under concurrent load. This makes authentication unreliable.
Fix: Either: (a) Upgrade to the Cloudflare Workers Unbound plan (recommended for production), or (b) replace bcrypt-ts with Web Crypto API's native SubtleCrypto for password hashing (e.g., PBKDF2 or Argon2id via a native binding), or (c) reduce salt rounds to 8 to cut CPU time in half (compromises security).

WARNINGS (Highly recommended to address)

7. Multi-Step Mutations Lack Database Transactions
Affected Files: server/api/habits/[id].ts (DELETE — 5 sequential writes), server/api/buckets/[id].ts (PUT — 8+ sequential writes), server/api/buckets/[id].ts (DELETE — 4 writes), server/api/habits/[id].ts (PUT — 3+ writes), server/api/friendships/[id].ts (DELETE — 6+ writes), server/utils/buckets.ts (syncSingleBucketLog — 3 writes)
Explanation: These endpoints perform multiple sequential SQL writes without wrapping them in a database transaction via db.transaction(). If any intermediate write fails (network blip, deadlock, unique constraint), the data enters an inconsistent state. For example, in habits/[id].ts DELETE (lines 103-123): if the bucketHabits deletion succeeds but the habitsTable deletion fails, the habit is still present but its bucket associations are lost. If the syncDeletions insertion fails, clients will never know the habit was deleted.
Business Impact: Intermittent race conditions during network issues produce irrecoverable data corruption. Hard to reproduce and debug.
Fix: Wrap multi-step mutations in await db.transaction(async (tx) => { ... }) using Drizzle's transaction API. Note that @neondatabase/serverless via HTTP has limited transaction support — verify it works. For the buckets.ts utility, pass a transaction object instead of the raw db.

8. Password Truncation by bcrypt
File: server/utils/validation.ts (line 47: password: z.string().min(8).max(128))
Explanation: bcrypt silently truncates input passwords to 72 bytes. A user setting a 128-character password has the last 56 characters ignored. Two different passwords that share the first 72 bytes will produce identical hashes. The validation accepts passwords that are effectively longer than what bcrypt processes.
Business Impact: Users think they have a 128-character password but only the first 72 bytes matter. An attacker only needs to brute-force the first 72 bytes.
Fix: Change validation to z.string().min(8).max(72) with a descriptive error message like "Password must be between 8 and 72 characters."

9. No Rate Limiting on Authentication & Search
Affected Files: server/api/auth/login.post.ts, server/api/auth/register.post.ts, server/api/users/search.get.ts
Explanation: No rate limiting exists at any layer (application, Cloudflare proxy rules, or WAF). An attacker can brute-force login attempts, enumerate users via the search endpoint, or flood registrations to exhaust database resources.
Business Impact: Credential stuffing attacks, account enumeration, and denial of service via rapid registration creation. Could lead to Neon's connection pool exhaustion.
Fix: Implement rate limiting. The simplest option is to enable Cloudflare WAF rate limiting rules for login/register/search paths. Alternatively, add application-level rate limiting using a Nitro middleware with in-memory counters or a KV store.

10. Login Identifier Wildcard Issue
File: server/api/auth/login.post.ts (lines 31-32)
Explanation: Using ILIKE for login allows pattern matching. If a user's username is john, an attacker could log in using JOHN (case-insensitive) or %ohn (wildcard). While the latter requires knowing part of the username, the case-insensitive behavior with a unique username constraint (also using ILIKE) means John and john are treated as different for uniqueness but identical for login, leading to confusion.
Business Impact: Ambiguous login behavior. User John and user john could both exist (ILIKE uniqueness in register.post.ts doesn't enforce uniqueness since ILIKE 'John' matches 'john' but the check only returns 409 if a row is found — if John already exists, registering john is blocked). Meanwhile login matches both.
Fix: Switch to exact comparison: use eq(users.username, identifier.toLowerCase()) and eq(users.email, identifier.toLowerCase()) with a functional lowercase index, or normalize all identifiers at registration/login.

11. /api/sync Returns All Data on First Sync (60-Day Window)
File: server/api/sync.get.ts (lines 43-48)
Explanation: When lastSynced is 0 but startDate/endDate are provided, the habit/bucket log queries return up to 60 days of logs. Without any date range filtering on the habits/buckets themselves (lines 21-24, 27-31), ALL habits and buckets are returned regardless of date range. For a power user with 30 habits each having 60 days of logs, that's 1,800 habit log rows plus 60 bucket log rows, all in a single JSON payload. On Cloudflare Workers, the response size limit is ~100 MB, but Neon's connection timeout and response streaming add constraints.
Business Impact: Initial sync for long-time users could time out or produce oversized responses that cause client memory pressure.
Fix: Implement pagination for the initial full sync (e.g., limit 500 rows per entity type with a continuation token). Or add a MAX(habitLogs.updatedAt) check to return incremental deltas only.

12. Legacy Log Purge on Every Sync Cycle
File: app/composables/useHabitsApi.ts (lines 528-539)
Explanation: On every sync cycle, the client scans ALL local habit logs and bucket logs to find "legacy" entries (IDs not containing _). For users with thousands of historical logs, this O(n) scan runs repeatedly.
Business Impact: UI jank on mobile devices during sync cycles for long-time users.
Fix: Run the legacy purge only once on first login (e.g., store a legacyPurgeDone flag in IndexedDB or localStorage) rather than on every sync.

13. Double-Fetch on Pusher Events (When Pusher is Fixed)
File: app/composables/useSocial.ts (lines 101-114)
Explanation: When a Pusher event triggers, the code optimistically updates friendships.value AND calls refresh() which re-fetches everything from the API. This results in two network round-trips per realtime event. Since Pusher isn't currently wired up, this is dormant — but when fixed, it creates unnecessary load.
Business Impact: Twice the API requests for realtime social events, slower perceived responsiveness.
Fix: Trust the optimistic update and skip refresh(), or only call refresh() for friendship-removed events (where the profile data doesn't change).

NITPICKS & BEST PRACTICES (Optional polish)

14. Reorder Endpoints Use Sequential UPDATEs
Files: server/api/habits/reorder.ts (lines 21-26), server/api/buckets/reorder.ts (lines 21-25)
Explanation: Both reorder endpoints perform N sequential UPDATE queries inside a loop (up to 30 iterations). This could be a single bulk update using:
UPDATE habits SET sort_order = CASE id WHEN 'id1' THEN 0 WHEN 'id2' THEN 1 ... END
WHERE owner_id = $userId AND id IN (...)
Impact: Minor latency increase at the 30-habit limit. Negligible for most use cases.

15. Global Cache-Control: no-cache Applies to Static Assets
File: nuxt.config.ts (lines 30-36)
Explanation: The route rule '/**': { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } } applies to ALL routes including static assets served from public/ (favicons, icons, manifest.json). These never change and could be cached aggressively.
Impact: Every page load re-fetches all static assets. Minor bandwidth increase.
Fix: Add specific route rules for /public/** or /icons/** with long cache lifetimes (e.g., Cache-Control: public, max-age=31536000, immutable).

16. nuxt.config.ts Line 45: Typo in Comment
Line 45 comment says pusherAppId but the actual key is pusherAppId. It's correct — no issue.

17. server/api/auth/logout.post.ts Only Deletes Cookie — Token Remains Valid
File: server/api/auth/logout.post.ts
Explanation: The logout endpoint only deletes the auth_token cookie but the JWT token remains valid for up to 7 days. If the token was captured/stolen before logout, it can still be used to authenticate requests via the Authorization: Bearer header (which getUserFromEvent in auth.ts line 31 checks alongside cookies).
Business Impact: A stolen token remains valid after logout. Combined with the lack of token invalidation on password change (item 16 in the existing review doc), this means JWTs are effectively irrevocable for their full 7-day lifetime.
Fix: Implement a token blacklist (e.g., store invalidated tokens in a Cloudflare KV or database table with TTL) or reduce the JWT lifetime to minutes with a refresh token mechanism.

18. Test Coverage Gaps
The test directory server/tests/ has 23 spec files, but no E2E tests exist at tests/e2e/ (referenced in playwright.config.ts). The .env file with production database URLs is committed to the repository (visible in the exploration output — check .env contents for potential credential exposure).

19. sync.get.ts Line 28: notExists with lastSynced condition
The lastSynced > 0 ternary for buckets at line 30 could produce undefined when lastSynced is 0, which Drizzle might handle differently on different versions. This is minor since it works in practice but could be made explicit.

SUMMARY
Severity	Count	Key Items
CRITICAL	6	Pusher non-functional (realtime dead), user deletion orphans data, JWT fallback in production, ILIKE uniqueness enumeration, habit log DELETE breaks streaks, bcrypt CPU timeouts
WARNING	7	Missing DB transactions, password truncation (128→72), no rate limiting, ILIKE login wildcards, sync payload size, legacy purge O(n), double-fetch on Pusher events
NITPICK	6	Sequential reorder updates, static asset caching, logout token persistence, test coverage gaps

The codebase is NOT safe for production deployment. The realtime layer is non-functional, account deletion violates data privacy, JWT security has a hardcoded fallback, and authentication queries are vulnerable to pattern-based enumeration. These must be addressed before deployment.
