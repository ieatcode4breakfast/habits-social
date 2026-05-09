# Production Readiness Review

This document outlines critical risks, warnings, and best practices identified during the pre-production audit of the **Habits Social** platform.

---

## 🛑 Critical Risks (Immediate Action Required)

### 1. Unbounded Payload in Initial Sync - DONE
- **Location**: `server/services/sync.service.ts` (`getDeltas` function)
- **Risk**: **Memory Exhaustion (OOM) / Timeout**.
- **Details**: The endpoint queries and returns all habits, buckets, and logs without limits or pagination. Long-term users syncing to new devices will generate massive payloads, risking server-side crashes and client-side instability.
- **Proposed Fix**: Implement cursor-based pagination or date-chunking.
  
```typescript
// Example adjustment in sync parameters:
const { lastSynced = 0, startDate, endDate, limit = 500, offset = 0 } = params;
// Apply limits and offsets to queries, and return whether more data exists
```

---

## ⚠️ Warnings (Highly Recommended)

### 1. Schema Type Mismatch for Foreign Keys
- **Location**: `server/db/schema.ts`
- **Details**: `users.id` is a `uuid`, but foreign keys in `habits`, `habitLogs`, and `buckets` are typed as `text`. This forces expensive manual type casting in joins (e.g., `sql`${habitLogs.ownerId}::uuid = ${users.id}``), bypassing index optimizations.
- **Proposed Fix**: Run a migration to convert `ownerId` columns to `uuid`.

```typescript
export const habits = pgTable('habits', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull(), // Change from text to uuid
  // ...
});
```

### 2. Missing Pagination for Social Feed
- **Location**: `server/api/social/feed.get.ts` (Lines 43, 67, 85)
- **Details**: The feed uses a hardcoded `.limit(100)` for various event types and merges them in memory. This prevents fetching older history and can lead to incorrect chronological ordering.
- **Proposed Fix**: Implement cursor-based pagination and push merging/sorting logic to the database (e.g., via `UNION ALL`).

### 3. Inefficient Bucket Log Re-evaluation
- **Location**: `server/utils/buckets.ts` (`reevaluateBucketLogs`)
- **Details**: Deletes and reconstructs historical logs synchronously in a loop. Large buckets will block the event loop and trigger timeouts.
- **Proposed Fix**: Use bulk inserts (`db.insert(...).values(array)`) or move re-evaluation to a background worker.

### 4. Unbounded PostgreSQL Arrays
- **Location**: `server/db/schema.ts` (`habits.sharedWith`)
- **Details**: `sharedWith` arrays are unbounded. Malicious clients could bloat table size and degrade query performance.
- **Proposed Fix**: Add a Zod validation limit (e.g., `.max(50)`) and a database-level `CHECK` constraint.

---

## 💡 Nitpicks & Best Practices

*   **Redundant Drizzle `.where()`**: In `habit-details.get.ts`, subsequent `.where()` calls overwrite the previous one. Use `and(...conditions)` for dynamic filtering.
*   **Ownership Scoping**: In `updateHabit`, explicitly include `eq(habitsTable.ownerId, userId)` in the `UPDATE` query as a "Defense in Depth" measure.
*   **Auth Timing Attacks**: Ensure the fallback dummy hash in `login.post.ts` matches the cost factor (10) used in registration to prevent timing leaks.
