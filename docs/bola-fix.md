# Implementation Plan - Core BOLA Fixes (Deletions & Streaks)

This plan addresses the most critical BOLA vulnerabilities where users can manipulate or delete data belonging to other users via direct API/Service calls.

## User Review Required

> [!IMPORTANT]
> This change enforces strict ownership at the service layer. Any existing tests that rely on shared access to these methods without explicit authentication context will fail and must be updated.

## Proposed Changes

### [Component] Security Tests
#### [NEW] [bola.core.spec.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/tests/bola.core.spec.ts)
A comprehensive security suite using `vitest` and `supertest` to verify isolation:
- **Case 1: Unauthorized Habit Deletion**:
  - Setup: User A creates a habit.
  - Attack: User B calls `DELETE /api/habits/[ID_OF_A]`.
  - Expectation: 404/403 response. Habit remains in DB for User A.
- **Case 2: Unauthorized Bucket Deletion**:
  - Setup: User A creates a bucket.
  - Attack: User B calls `DELETE /api/buckets/[ID_OF_A]`.
  - Expectation: 404/403. Bucket remains in DB.
- **Case 3: Unauthorized Bucket Update**:
  - Setup: User A creates a bucket.
  - Attack: User B calls `PUT /api/buckets/[ID_OF_A]` with a new title.
  - Expectation: 404/403. Title remains unchanged.
- **Case 4: Streak Hijacking (Direct Utility Call)**:
  - Setup: User A has a 10-day streak.
  - Attack: Trigger `recalculateHabitStreak` for User A's habit but passing User B's `userId`.
  - Expectation: Habit streak remains 10. Victim's habit record is not updated by the attacker's empty log state.

---

### [Component] Habit Service
#### [MODIFY] [habit.service.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/services/habit.service.ts)
- **`deleteHabit`**: 
  - Update `tx.delete(habitsTable).where(and(eq(habitsTable.id, id), eq(habitsTable.ownerId, userId)))`.
  - Check the `returning()` or `rowsAffected` result.
  - **Only** if a row was actually deleted, proceed to:
    - Delete from `bucketHabits`.
    - Insert into `syncDeletions` (using the verified `userId`).
    - Trigger `reevaluateMultipleBuckets`.
  - If no row was deleted, throw a 404.

---

### [Component] Bucket Service
#### [MODIFY] [bucket.service.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/services/bucket.service.ts)
- **`updateBucket`**: 
  - Update the `tx.update(bucketsTable).where(and(eq(bucketsTable.id, id), eq(bucketsTable.ownerId, userId)))`.
  - If `result.length === 0`, throw a 404 immediately before attempting to update habit associations.
- **`deleteBucket`**: 
  - Update `tx.delete(bucketsTable).where(and(eq(bucketsTable.id, id), eq(bucketsTable.ownerId, userId)))`.
  - Update `tx.delete(sharedBucketMembers)` and `tx.delete(bucketHabits)` to also include an ownership check if possible, or ensure they only run if the parent bucket deletion was successful.
  - Only insert into `syncDeletions` if the bucket was actually removed.

---

### [Component] Streak Utilities
#### [MODIFY] [streaks.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/utils/streaks.ts)
- **`recalculateHabitStreak`**: 
  - Update the initial `habitRes` query to include `eq(habits.ownerId, userId)`.
  - If `!habitRes[0]`, return early. This prevents the utility from proceeding with logs that don't belong to the habit owner.
  - Update all subsequent `db.update(habits)` calls (lines 64, 75, 111) to include the `eq(habits.ownerId, userId)` filter in their `.where()` clause.

---

### [Component] Habit Logs API
#### [MODIFY] [index.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/api/habitlogs/index.ts)
- **`DELETE` handler**: 
  - Add an explicit check: `db.select().from(habitsTable).where(and(eq(id, habitId), eq(ownerId, userId)))`.
  - This ensures a user can't trigger streak/bucket syncs for a habit ID they don't own.

---

## Verification Plan

### Automated Tests
1. **Confirm Vulnerability**:
   ```bash
   npx vitest server/tests/bola.core.spec.ts
   ```
   *Expected: Failures in all 4 cases.* 

2. **Apply All Fixes**.

3. **Verify Security**:
   ```bash
   npx vitest server/tests/bola.core.spec.ts
   ```
   *Expected: All pass.* 

4. **Sanity Check**:
   ```bash
   npm test
   ```
   *Expected: No regressions in standard Habit/Bucket CRUD.*
