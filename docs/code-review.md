# Code Review

---

## 🟡 WARNINGS (Highly recommended to address)
*UX failures, data integrity issues, scalability issues, and technical debt.*

### 4. Broken Shared Bucket Sync - DEFERRED
- **Location:** `server/services/sync.service.ts`
- **Issue:** The sync engine doesn't fetch metadata for habits owned by friends, even if they are in a shared bucket.
- **Fix:** Expand sync queries to include habits where the user is an accepted bucket member.

### 5. Missing Rate Limiting on Auth - DEFERRED
- **Location:** `server/api/auth/login.post.ts`
- **Issue:** Vulnerability to credential stuffing and brute-force attacks.
- **Fix:** Implement rate limiting middleware for auth routes.

### 6. Missing API for Accepting Shared Habits - DEFERRED
- **Location:** `server/services/bucket.service.ts`
- **Issue:** No endpoint exists for a user to accept a friend's habit invitation into their bucket.
- **Fix:** Create a member status update endpoint.

### 7. Unbounded Payload Limits - DEFERRED
- **Location:** `server/utils/validation.ts` (e.g., `shareHabitsSchema`, `habitSchema`)
- **Issue:** Several schemas lack `.max()` constraints on arrays and strings, leaving the application vulnerable to memory exhaustion if a massive payload bypasses network-level WAF limits.
- **Fix:** Enforce explicit business-logic `.max()` boundaries on all Zod arrays and strings.

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

---

## 📝 NOTES

### 1. Habit-Level Privacy Policy (By Design)
It is a core architectural decision that **Sharing a Habit = Sharing all its Logs**. 
- The `shared_with` column on `habit_logs` is deprecated and intentionally ignored by the API layer.
- Visibility is controlled exclusively by the `habits.shared_with` array.
- **DO NOT FLAG** "Missing hl.shared_with checks" in future audits; authorization is intentionally centralized at the parent object for data integrity and simplicity.

### 2. Local-First Timestamp Integrity (By Design)
The frontend manages its own `updatedAt` timestamps locally to maintain optimistic UI state and local-first reconciliation logic.
- **DO NOT SUGGEST** changing how the client handles these timestamps or replacing them with server-assigned values during local operations.
- The server's use of `CLOCK_TIMESTAMP()` is strictly for backend-side sync anchors and database reconciliation.
