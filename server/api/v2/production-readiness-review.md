Here is the production-readiness review for all files under `server/api/v2`.

A. CRITICAL ISSUES (Must fix before deployment)

1. Authorization Bypass via `ON CONFLICT` (Data Overwrite) - ADDRESSED
`bucketlogs/index.ts` (POST), `habitlogs/index.ts` (POST), and `buckets/index.ts` (POST) use `INSERT ... ON CONFLICT (id) DO UPDATE` without a `WHERE` clause restricting updates to rows owned by the authenticated user. Unlike `habits/index.ts` which correctly includes `WHERE habits.ownerid = EXCLUDED.ownerid`, these endpoints allow any user to overwrite another user's records by providing a known ID. For bucketlogs, IDs are deterministic (`${bucketId}_${date}_${userId}`), making targeted overwrites trivial.
- **Fix**: Add `WHERE <table>.ownerid = EXCLUDED.ownerid` to every `ON CONFLICT DO UPDATE`. Example for `bucketlogs`:
  `ON CONFLICT (id) DO UPDATE SET ... WHERE bucketlogs.ownerid = EXCLUDED.ownerid`

2. Exposure of Private Email Addresses - ADDRESSED
`users/search.get.ts` (line 14) and `users/[id]/profile.get.ts` (line 16) include `email` in the `SELECT` list and return it in the JSON payload. This exposes Personally Identifiable Information (PII) to any authenticated user.
- **Fix**: Remove `email` from both `SELECT` clauses. If contact data is needed for a feature, gate it behind explicit privacy settings.

3. Unverified Friendship During Sharing - ADDRESSED
`social/share-habits.post.ts` allows any authenticated user to share habits with any other user ID, regardless of friendship status. This circumvents the social-graph protections and enables spam/harassment.
- **Fix**: Before processing, verify an `accepted` friendship exists between `userId` and `targetUserId`.

B. WARNINGS (Highly recommended to address)

6. Streak Recalculation Ignores Skip Policy — RESOLVED (By Design)
`docs/streak-logic.md:46-48` specifies that gap detection always resets the streak and skipped days are ignored. The skip budget (`skipsPeriod`/`skipsCount`) is a frontend-only UI gate (see `LogMenu.vue:84-107`) and must not affect server-side streak recalculation. The unused column fetches in `_utils/streaks.ts` have been removed.

7. Unvalidated `lastSynced` Parameter Causes SQL Errors - ADDRESSED
`buckets/index.ts` (GET) and `habitlogs/index.ts` (GET) pass `Number(query.lastSynced)` directly to `to_timestamp()` without checking `isNaN`. If the client sends a non-numeric value, the query will fail or behave unpredictably. (`habits/index.ts` correctly validates this.)
- **Fix**: Add the same `if (isNaN(lastSynced))` guard that `habits/index.ts` uses.

8. Accepting Your Own Friend Request - ADDRESSED
`friendships/[id].ts` (PUT) allows the initiator of a friendship to accept it. Only the receiver should be able to accept a pending request.
- **Fix**: Verify `friendship.receiverId === userId` before updating the status to `'accepted'`.

9. No Rate Limiting on Authentication & Search
`auth/register.post.ts`, `auth/login.post.ts`, and `users/search.get.ts` have no rate limiting. This exposes the application to brute-force attacks, credential stuffing, and scraping.
- **Fix**: Apply rate limiting at the gateway (Cloudflare, nginx) or implement application-level request throttling (e.g., `h3-rate-limiter`).

10. Multi-Step Mutations Lack Transactions
Most endpoints perform multiple sequential SQL writes (e.g., habit deletion + bucket log re-evaluation, bucket update + shared member cleanup) without wrapping them in a database transaction. A partial failure leaves data in an inconsistent state.
- **Fix**: Use `sql.begin()` (or `sql.transaction()`) from `@neondatabase/serverless` to group logically atomic operations.

11. Password Length DoS Vector - ADDRESSED
`auth/register.post.ts` does not enforce a maximum password length before hashing. bcrypt truncates at 72 bytes, but hashing extremely large payloads wastes CPU and can be abused for denial-of-service.
- **Fix**: Reject passwords longer than 128 characters in the validation layer.

12. Timezone Sensitivity in Date Normalization
`_utils/normalize.ts` uses `date-fns` `format(new Date(dateStr), 'yyyy-MM-dd')`, which formats in the server's local timezone. If the server is not UTC, timestamps near midnight can produce incorrect calendar dates.
- **Fix**: Use UTC-aware formatting (e.g., `formatInTimeZone` from `date-fns-tz`) or standardize on UTC server time.

13. Search Param Type Safety
`users/search.get.ts` (line 10) does `String(username)`. If the query parser returns an object or array, this produces `"[object Object]"`. Also, an extremely long input string wastes DB cycles on `ILIKE`. - ADDRESSED
- **Fix**: Validate that `username` is a string and cap its length (e.g., max 100 chars) before the query.

14. User Deletion Assumes Database Cascades
`users/me.delete.ts` attempts a bare `DELETE FROM users`. If foreign key constraints lack `ON DELETE CASCADE`, the endpoint will crash with a 500 error.
- **Fix**: Either confirm cascading is configured at the schema level, or wrap explicit dependent-row deletions in a transaction.

15. PII Leak via Registration Error Messages - ADDRESSED
`auth/register.post.ts` returns distinct error messages for existing email vs. existing username, allowing an attacker to enumerate registered accounts.
- **Fix**: Return a single generic message for both conflicts (e.g., "Email or username already taken").

16. Token Invalidation on Password Change
`users/me.put.ts` updates `passwordHash` but does not invalidate existing JWTs. A leaked token remains valid for up to 7 days after a password change.
- **Fix**: Consider versioning passwords (e.g., add a `tokenVersion` column to users, embed it in the JWT, and increment it on password change) or rely on short-lived tokens with refresh logic.

C. NITPICKS & BEST PRACTICES

17. `/auth/me.get.ts` returns HTTP 200 `{ data: null }` for unauthenticated clients. Standard REST semantics expect 401. If the frontend relies on this behavior, document it explicitly in a comment. - ADDRESSED
18. Dead code in `buckets/index.ts`: `const bucketId = data.id || \`\${userId}_${Date.now()}\`;` is computed but never referenced. - ADDRESSED
19. Avoid `SELECT *` in production queries. `auth/login.post.ts`, `users/me.put.ts`, and `friendships/index.ts` all select more columns than needed, increasing the risk of accidental PII leakage and unnecessary data transfer.
20. Zod schema duplication: `users/me.put.ts` defines `updateProfileSchema` inline, while `_utils/validation.ts` exports a nearly identical one. Consolidate schemas to prevent future drift. - ADDRESSED
21. `friendships/[id].ts` (DELETE) updates `sharedwith` arrays in four sequential `UPDATE` statements. If the schema uses `text[]`, ensure `array_remove` handles these correctly for large arrays, or consider normalizing sharing relationships into a junction table.
22. In `social/habit-details.get.ts` and `social/friend-data.get.ts`, `startDateStr` and `endDateStr` are accepted from query params without validating they conform to `YYYY-MM-DD`. Invalid formats will result in SQL errors or incorrect filtering. - ADDRESSED
23. `habits/reorder.ts` and `buckets/reorder.ts` perform N sequential `UPDATE` calls inside a loop. While N is capped by the app limit (30), consider using a single bulk update with `CASE` or `UNNEST` for atomicity and efficiency.

### D. PRIORITIZED TO-DO LIST (By Complexity)

#### 🟡 Phase 2: Low to Medium Complexity
- [ ] **Item 19**: Replace `SELECT *` with explicit column lists in identified endpoints.
- [ ] **Item 12**: Standardize UTC date normalization.

#### 🔴 Phase 3: Higher Complexity (Strategic)
- [ ] **Item 10**: Wrap multi-step mutations in database transactions.
- [ ] **Item 16**: Implement token invalidation on password change.
- [ ] **Item 14**: Verify/implement cascading deletes for user accounts.
- [ ] **Item 23**: Bulk update optimization for reorder endpoints.
- [ ] **Item 9**: Implement rate limiting on authentication and search endpoints.
- [ ] **Item 21**: Normalize sharing relationships or ensure safe array updates for `sharedwith`.