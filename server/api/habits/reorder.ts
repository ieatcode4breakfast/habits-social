import { Habit } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);

  const { ids } = await readBody(event);
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids must be an array' });

  await Promise.all(
    ids.map((id: string, index: number) =>
      Habit.updateOne({ _id: id, ownerid: userId }, { sortOrder: index })
    )
  );

  return { success: true };
});
