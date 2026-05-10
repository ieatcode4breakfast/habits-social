import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestBucket, db } from './test.utils';
import { buckets as bucketsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { recalculateMultipleBucketStreaks } from '../utils/buckets';

describe('BOLA Regression: Bucket Streak Protection', () => {
  let userA: any;
  let userB: any;
  let bucketA: any;
  let bucketB: any;

  beforeAll(async () => {
    userA = await createTestUser(`bola_reg_a_${Date.now()}`, `bola_ra_${Date.now()}@ex.com`);
    userB = await createTestUser(`bola_reg_b_${Date.now()}`, `bola_rb_${Date.now()}@ex.com`);
    bucketA = await createTestBucket(userA.id, 'User A Bucket');
    bucketB = await createTestBucket(userB.id, 'User B Bucket');
  });

  afterAll(async () => {
    if (bucketA?.id) await db.delete(bucketsTable).where(eq(bucketsTable.id, bucketA.id));
    if (bucketB?.id) await db.delete(bucketsTable).where(eq(bucketsTable.id, bucketB.id));
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('SHOULD allow owner to update their own bucket streak', async () => {
    // Set initial streak to 5
    await db.update(bucketsTable)
      .set({ currentStreak: 5, longestStreak: 5 })
      .where(eq(bucketsTable.id, bucketA.id));

    // Owner (User A) recalculates - since no logs, it should reset to 0 but it's a valid ownership check
    await recalculateMultipleBucketStreaks(db, [{ bucketId: bucketA.id, ownerId: userA.id }]);

    const check = await db.select().from(bucketsTable).where(eq(bucketsTable.id, bucketA.id));
    expect(check[0]?.currentStreak).toBe(0); // Successfully updated/reset by owner
  });

  it('SHOULD NOT allow non-owner to update/corrupt someone else’s bucket streak', async () => {
    // 1. Setup: User A's bucket has a streak of 20
    await db.update(bucketsTable)
      .set({ currentStreak: 20, longestStreak: 20 })
      .where(eq(bucketsTable.id, bucketA.id));

    // 2. Exploit Attempt: User B tries to recalculate streaks for User A's bucketId
    // This happens internally if User B deletes a shared habit in User A's bucket.
    await recalculateMultipleBucketStreaks(db, [{ bucketId: bucketA.id, ownerId: userB.id }]);

    // 3. Verification: User A's streak must remain 20
    const check = await db.select().from(bucketsTable).where(eq(bucketsTable.id, bucketA.id));
    expect(check[0]?.currentStreak).toBe(20); 
  });
});
