import type { IHabit } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB();
  const userId = await requireAuth(event);

  const { targetUserId, habitIds } = await readBody(event);
  if (!targetUserId || !Array.isArray(habitIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing targetUserId or habitIds array' });
  }

  const targetId = String(targetUserId);

  if (habitIds.length > 0) {
    const objectIds = habitIds.map((id: string) => new ObjectId(id));
    await db.collection<IHabit>('habits').updateMany(
      { _id: { $in: objectIds }, ownerid: userId },
      { $addToSet: { sharedwith: targetId } }
    );
  }

  return { success: true };
});
