import { IHabit } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB();
  const userId = await requireAuth(event);

  const { ids } = await readBody(event);
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids must be an array' });

  const bulkOps = ids.map((id, index) => ({
    updateOne: {
      filter: { _id: new ObjectId(id), ownerid: userId },
      update: { $set: { sortOrder: index } }
    }
  }));

  if (bulkOps.length > 0) {
    await db.collection<IHabit>('habits').bulkWrite(bulkOps);
  }

  return { success: true };
});
