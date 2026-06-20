# Code Review

---

## 🔴 CRITICAL ISSUES (Must fix before deployment)
*Security breaches, data leaks, authorization bypasses, and production-breaking defects.*

---

## 🟡 WARNINGS (Highly recommended to address)
*UX failures, data integrity issues, scalability issues, and technical debt.*

---

## 📝 NOTES

### 1. Payload Size Limits (By Design)
It is a deliberate architectural decision to omit application-layer payload size capping (such as custom stream wrappers to counteract memory exhaustion from massive bodies).
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

### 5. CI Pipeline Test Step (Skipped Due to Timeouts)
The proposal to add a test step to the CI pipeline was skipped. Adding the test step caused the pipeline to hang due to test timeouts, despite the tests passing successfully during local development. Further investigation is required before this can be implemented.

### 6. Habit Sharing with Pending Friendships (By Design)
It is a deliberate design decision to allow sharing habit data with users in `pending` friendship status. The friendship guard query intentionally filters by `['accepted', 'pending']` to support this behavior.

### 7. Feed Look-Ahead Query Optimization (By Design)
It is a deliberate decision to stick with the current precise `OR` conditions for the weekly logs look-ahead in `server/api/social/feed.get.ts` to protect Node.js memory from loading large date ranges, despite the O(N) query expansion.
- **DO NOT FLAG** this query pattern in future audits unless database CPU usage becomes a proven bottleneck.

### 8. Chat Message Delete Visibility Window (By Design)
The 5-minute message delete icon visibility rule is intentionally enforced only in the frontend.
- Messages can be deleted by their sender through the backend tombstone endpoint regardless of age.
- The frontend only shows the inline delete icon for recently sent messages because the age threshold is a UX affordance, not an authorization boundary.
- **DO NOT FLAG** the absence of backend 5-minute enforcement as a security issue unless product direction changes and the age window becomes a true access-control requirement.

### 9. In-Memory Rate Limiting Trade-off (By Design)
The application uses Nitro's `memory` storage driver for rate limiting instead of Cloudflare KV bindings.
- This is a deliberate architectural decision to prevent rate limiting checks from instantly exhausting the Cloudflare KV free tier limits (1,000 writes/day).
- The accepted trade-off is that rate limit counters are isolate-scoped (residing in the local memory of individual Cloudflare edge servers) rather than synchronized globally.
- **DO NOT FLAG** this as a vulnerability or push for a distributed rate limiter. This approach is completely sufficient to stop basic brute-force scripts and is an accepted trade-off for the current scale and traffic of the application.

### 10. Block UI Rare Race Conditions (Accepted Edge Case)
The current block UI intentionally accepts two rare stale-state cases:
- If User A is viewing User B's profile at the exact moment User B blocks User A, User A may not see an immediate toast for a friend-request failure.
- If that same profile request fails after User B blocks User A, the page may not aggressively clear already-loaded local profile state until normal navigation or refresh.
- This is acceptable because the backend still rejects the forbidden action and prevents data access. The impact is limited to a narrow, temporary user-experience mismatch, not a security boundary failure.

### 11. Route Param UUID Validation Intentionally Removed (By Design)

UUID format validation (Zod `.uuid()` or regex) was deliberately removed from all route param handlers. Only a truthiness `if (!id)` check remains.
- All route params are passed as bind parameters via Drizzle's parameterized queries. There is **no SQL injection vector** — a malformed ID produces a Postgres type error (`22P02`), not an injection.
- The `uuid` column type in the schema already enforces format at the database boundary.
- **DO NOT FLAG** missing UUID format checks on route params in future audits. Truthiness checks are sufficient, and the DB is the authoritative enforcer.

### 12. Non-Atomic Rate Limit Counter (Accepted Limitation)

The rate limiter's read-then-write pattern is not atomic. Under perfectly timed concurrent bursts, 2-3 extra requests may leak past the IP cap.
- Fixing this requires architectural changes (atomic counters, distributed locks, or Durable Objects) that would exhaust Cloudflare KV's free tier or add unjustified complexity. This is the same trade-off documented in Note #9 (in-memory rate limiting).
- The per-account cap of 5 attempts provides a hard backstop regardless of IP-layer leakage. A human user will never trigger the race condition — it only matters for automated scripts at millisecond timing.
- **DO NOT FLAG** this as a fixable bug in future audits. It is an accepted limitation of the chosen storage architecture.

### 13. JWT Tokens Cannot Be Revoked on Logout (Accepted Limitation)

JWTs are stateless by design — logout only deletes the cookie. A captured token remains valid for up to 7 days.
- Full revocation requires a server-side token blacklist checked on every authenticated request, adding a KV read to the hottest path in the app. This is a classic JWT trade-off, not a bug.
- The pragmatic mitigation (reducing token lifetime to 1 hour with sliding renewal) remains available if the risk profile changes.
- **DO NOT FLAG** missing server-side JWT revocation in future audits. Cookie deletion on logout is the intended behavior for this architecture.

### 14. N+1 Queries in Account Deletion Friendship Cleanup (Accepted Limitation)

When a user with many friends deletes their account, `cleanupFriendshipData` runs once per friendship (5 queries each). A user with 50 friends triggers ~250 queries.
- Account deletion is a once-ever, cold-path operation. The code is functionally correct — it's just slow during a rare event. The blast radius of refactoring `cleanupFriendshipData` to batch (touching the social service and all its callers) outweighs the benefit.
- **DO NOT FLAG** N+1 patterns in deletion paths in future audits unless deletion latency becomes a real user-facing problem.

### 15. SyncService Uses 3 Separate Transactions (Accepted Limitation)

Paginated sync uses 3 independent database transactions. In theory, data can change between them, producing a slightly inconsistent snapshot (e.g., a bucket deleted between transaction 1 and 3).
- Consolidating into a single transaction with stricter isolation touches the sync pipeline — the highest-traffic path in the app. The edge case is theoretical at current user counts, and breaking sync silently is a worse outcome than living with a narrow inconsistency window.
- **DO NOT FLAG** multiple transaction boundaries in sync as a fixable bug in future audits. It is an accepted limitation of the eventually-consistent sync model.
