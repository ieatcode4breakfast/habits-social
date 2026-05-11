import { eq, and, or, sql } from 'drizzle-orm';
import { friendships as friendshipsTable, habits, habitLogs, users } from '~~/server/db/schema';
import { extractRows } from '~~/server/utils/db';
import { reevaluateMultipleBuckets } from '~~/server/utils/buckets';
import { usePusher } from '~~/server/utils/pusher';

export const SocialService = {
  async createFriendship(db: any, initiatorId: string, targetUserId: string, event: any) {
    const result = await db.insert(friendshipsTable)
      .values({
        id: crypto.randomUUID(),
        initiatorId,
        receiverId: targetUserId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    const friendship = result[0];
    if (friendship) {
      const pusher = usePusher(event);
      if (pusher) {
        // Fetch initiator profile for the receiver
        const initiatorProfile = await db.select({
          id: users.id,
          username: users.username,
          photoUrl: users.photoUrl
        })
        .from(users)
        .where(eq(users.id, initiatorId))
        .then((res: any[]) => res[0]);

        pusher.trigger(`user-${targetUserId}-social`, 'friend-request-received', {
          ...friendship,
          profile: initiatorProfile
        });
      }
    }
    return friendship;
  },

  async acceptFriendship(db: any, userId: string, id: string, event: any) {
    const result = await db.update(friendshipsTable)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.receiverId, userId)))
      .returning();

    const friendship = result[0];
    if (friendship) {
      const pusher = usePusher(event);
      if (pusher) {
        // Fetch receiver profile for the initiator
        const receiverProfile = await db.select({
          id: users.id,
          username: users.username,
          photoUrl: users.photoUrl
        })
        .from(users)
        .where(eq(users.id, friendship.receiverId))
        .then((res: any[]) => res[0]);

        // Fetch initiator profile for the receiver
        const initiatorProfile = await db.select({
          id: users.id,
          username: users.username,
          photoUrl: users.photoUrl
        })
        .from(users)
        .where(eq(users.id, friendship.initiatorId))
        .then((res: any[]) => res[0]);

        pusher.trigger(`user-${friendship.initiatorId}-social`, 'friend-request-accepted', {
          ...friendship,
          profile: receiverProfile
        });
        pusher.trigger(`user-${friendship.receiverId}-social`, 'friend-request-accepted', {
          ...friendship,
          profile: initiatorProfile
        });
      }
    }
    return friendship;
  },

  async removeFriendship(db: any, userId: string, id: string, event: any) {
    const friendshipsRes = await db.select()
      .from(friendshipsTable)
      .where(eq(friendshipsTable.id, id));
    
    if (friendshipsRes.length === 0) return false;

    const friendship = friendshipsRes[0];
    const u1 = friendship.initiatorId;
    const u2 = friendship.receiverId;

    // Cascade 'removed' status for cross-owned bucket habits
    const affected = await db.execute(sql`
      UPDATE bucket_habits bh
      SET approval_status = 'removed'
      FROM buckets b, habits h
      WHERE bh.bucket_id = b.id AND bh.habit_id = h.id
        AND (
          (h.owner_id = ${u1} AND b.owner_id = ${u2})
          OR (h.owner_id = ${u2} AND b.owner_id = ${u1})
        )
        AND bh.approval_status != 'removed'
      RETURNING bh.bucket_id, b.owner_id
    `);

    const rows = extractRows<{ bucket_id: string, owner_id: string }>(affected);
    if (rows.length > 0) {
      await reevaluateMultipleBuckets(db, rows.map(r => ({ bucketId: r.bucket_id, ownerId: r.owner_id })));
    }

    // Cleanup sharing flags
    await db.update(habits)
      .set({ sharedWith: sql`array_remove(shared_with, ${u2})` })
      .where(eq(habits.ownerId, u1));
    
    await db.update(habits)
      .set({ sharedWith: sql`array_remove(shared_with, ${u1})` })
      .where(eq(habits.ownerId, u2));
    
    await db.update(habitLogs)
      .set({ sharedWith: sql`array_remove(shared_with, ${u2})` })
      .where(eq(habitLogs.ownerId, u1));
    
    await db.update(habitLogs)
      .set({ sharedWith: sql`array_remove(shared_with, ${u1})` })
      .where(eq(habitLogs.ownerId, u2));

    await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${u1}-social`, 'friendship-removed', { id });
      pusher.trigger(`user-${u2}-social`, 'friendship-removed', { id });
    }

    return true;
  }
};
