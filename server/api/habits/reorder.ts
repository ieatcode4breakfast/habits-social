import { Habit } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);

  const { ids } = await readBody(event);
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids must be an array' });

  const bulkOps = ids.map((id, index) => ({
    updateOne: {
      filter: { _id: id, ownerid: userId },
      update: { $set: { sortOrder: index } }
    }
  }));

  if (bulkOps.length > 0) {
    await Habit.bulkWrite(bulkOps);
  }

  return { success: true };
});
