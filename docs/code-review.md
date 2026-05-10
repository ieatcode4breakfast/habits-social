# Code Review

## 🔴 CRITICAL ISSUES (Must fix before deployment)
*App-breaking vulnerabilities and immediately exploitable security flaws via DevTools/Console.*

### 1. Broken Object Level Authorization (BOLA) - Core Deletion & Streaks
- **Locations:** 
  - `server/api/habitlogs/index.ts` (DELETE handler)
  - `server/services/habit.service.ts` (`deleteHabit`)
  - `server/services/bucket.service.ts` (`updateBucket`, `deleteBucket`)
  - `server/utils/streaks.ts` (`recalculateHabitStreak`)
- **Exploit:** Any logged-in user can delete anyone's habits/buckets or reset anyone's streaks by sending a `fetch` request from the browser console with a victim's UUID. 
- **Fix:** Enforce `ownerId: userId` check in all `UPDATE` and `DELETE` operations.

### 2. Social Feed Privacy Leak (hl.shared_with)
- **Location:** `server/api/social/feed.get.ts`
- **Exploit:** The feed query uses the parent habit's settings instead of the log's specific `shared_with` array. Users can see logs that were explicitly marked as "Private."
- **Fix:** Update the SQL to authorize against `hl.shared_with`.

### 3. Database Denial of Service (DoS)
- **Location:** `server/api/buckets/reorder.ts` & `server/api/habits/reorder.ts`
- **Exploit:** An attacker can submit an array of 50,000+ IDs to the reorder endpoint, generating a massive SQL query that locks the database and crashes the app for all users.
- **Fix:** Add a strict `.max(100)` limit to the IDs array in the validation schema.

---

## 🟡 WARNINGS (Highly recommended to address)
*UX failures, data integrity issues, and technical debt.*

### 1. Sync Deletion Misattribution ("Ghost" Records)
- **Location:** Deletion services in `habit.service.ts` and `bucket.service.ts`.
- **Issue:** When an attacker deletes a victim's record, the `sync_deletions` record is saved under the attacker's ID. The victim's app never receives the sync event and continues showing stale "ghost" data.
- **Fix:** Ensure `sync_deletions` records the event under the object's true `ownerId`.

### 2. Account Deletion Data Rot
- **Location:** `server/api/users/me.delete.ts`
- **Issue:** Raw deletes bypass cascading logic, leaving orphaned data and breaking friends' bucket views.
- **Fix:** Refactor to use service-layer deletion logic.

### 3. Fragile SQL Condition Logic (Drizzle Overwrites)
- **Location:** `server/utils/streaks.ts`
- **Issue:** Subsequent `.where()` calls in Drizzle overwrite previous ones. A small code change could accidentally remove ownership checks.
- **Fix:** Use `and()` utility to combine conditions.

### 4. Private Habit ID Probing
- **Location:** `server/services/bucket.service.ts` (`updateBucket`)
- **Issue:** The return value of `updateBucket` leaks the existence of private `habitIds` to anyone who can guess a bucket UUID.
- **Fix:** Sanitize return values to only include habit mappings if authorized.

### 5. Broken Shared Bucket Sync - DEFERRED
- **Location:** `server/services/sync.service.ts`
- **Issue:** The sync engine doesn't fetch metadata for habits owned by friends, even if they are in a shared bucket.
- **Fix:** Expand sync queries to include habits where the user is an accepted bucket member.

### 6. Missing Rate Limiting on Auth - DEFERRED
- **Location:** `server/api/auth/login.post.ts`
- **Issue:** Vulnerability to credential stuffing and brute-force attacks.
- **Fix:** Implement rate limiting middleware for auth routes.

### 7. Missing API for Accepting Shared Habits - DEFERRED
- **Location:** `server/services/bucket.service.ts`
- **Issue:** No endpoint exists for a user to accept a friend's habit invitation into their bucket.
- **Fix:** Create a member status update endpoint.

---

## 🔵 NITPICKS & BEST PRACTICES

### 1. Redundant Service-Layer Ownership Checks
- **Location:** `HabitService` and `BucketService` log methods.
- **Note:** Currently protected by API-layer guards.

### 2. Self-Friendship Anomaly
- **Location:** `SocialService.createFriendship`
- **Note:** Users can friend themselves.

### 3. SQL Performance (LATERAL join)
- **Location:** `server/api/social/feed.get.ts`
- **Note:** Fine for small groups, but will bottleneck at scale.

### 4. Magic Strings for Defaults - DEFERRED
- **Location:** `server/utils/validation.ts`
- **Note:** Hardcoded hex colors and limits.
- **Fix:** Extract to a shared `constants.ts`.
