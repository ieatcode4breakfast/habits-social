# Code Review

---

## 🟡 WARNINGS (Highly recommended to address)
*UX failures, data integrity issues, scalability issues, and technical debt.*

### 1. Broken Shared Bucket Sync - DEFERRED
- **Location:** `server/services/sync.service.ts`
- **Issue:** The sync engine doesn't fetch metadata for habits owned by friends, even if they are in a shared bucket.
- **Fix:** Expand sync queries to include habits where the user is an accepted bucket member.

### 2. Missing API for Accepting Shared Habits - DEFERRED
- **Location:** `server/services/bucket.service.ts`
- **Issue:** No endpoint exists for a user to accept a friend's habit invitation into their bucket.
- **Fix:** Create a member status update endpoint.

---

## 🔵 NITPICKS & BEST PRACTICES

### 1. SQL Performance (LATERAL join) - DEFERRED
- **Location:** `server/api/social/feed.get.ts`
- **Note:** Fine for small groups, but will bottleneck at scale.

### 2. Magic Strings for Defaults - DEFERRED
- **Location:** `server/utils/validation.ts`
- **Note:** Hardcoded hex colors and limits.
- **Fix:** Extract to a shared `constants.ts`.

---

## 📝 NOTES

### 1. Payload Size Limits (By Design)
It is a deliberate architectural decision to omit application-layer payload size limits (e.g., Zod `.max()` on massive strings or custom stream wrappers).
- Adding complex application-layer stream parsing to counteract memory exhaustion (OOM) introduces unnecessary abstraction overhead for a hobby project.
- If the application scales and requires robust DoS protection, we will solve it at the infrastructure layer by upgrading the Cloudflare WAF plan (Business/Enterprise) to utilize native `http.request.body.size` checks or regex-based header filtering.

### 2. Habit-Level Privacy Policy (By Design)
It is a core architectural decision that **Sharing a Habit = Sharing all its Logs**. 
- The `shared_with` column on `habit_logs` is deprecated and intentionally ignored by the API layer.
- Visibility is controlled exclusively by the `habits.shared_with` array.
- **DO NOT FLAG** "Missing hl.shared_with checks" in future audits; authorization is intentionally centralized at the parent object for data integrity and simplicity.

### 3. Local-First Timestamp Integrity (By Design)
The frontend manages its own `updatedAt` timestamps locally to maintain optimistic UI state and local-first reconciliation logic.
- **DO NOT SUGGEST** changing how the client handles these timestamps or replacing them with server-assigned values during local operations.
- The server's use of `CLOCK_TIMESTAMP()` is strictly for backend-side sync anchors and database reconciliation.

### 4. Service-Layer Ownership Checks (By Design for Security)
The ownership checks in `HabitService.logHabit` and `BucketService.logBucket` (specifically the `where` clause in `onConflictDoUpdate`) are **not redundant**.
- The API layer only validates that the user owns the `habitId` or `bucketId`.
- Since the schemas allow client-provided log `id`s, an attacker could target an existing log ID belonging to another user.
- The service-layer check `where: eq(ownerId, userId)` provides critical defense-in-depth, ensuring that a user can never overwrite a log they do not own, even if they guess the ID.
- **DO NOT REMOVE** these checks as they are essential for zero-trust fail-safes against ID collision/hijacking attacks.
