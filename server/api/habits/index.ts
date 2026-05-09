import { eq, and, gte, asc, desc, sql } from 'drizzle-orm';
import { habits as habitsTable } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { habitSchema, throwZodError } from '~~/server/utils/validation';
import { HabitService } from '~~/server/services/habit.service';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    const q = db.select().from(habitsTable).where(eq(habitsTable.ownerId, userId));

    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      if (isNaN(lastSynced)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid lastSynced parameter' });
      }
      q.where(and(eq(habitsTable.ownerId, userId), gte(habitsTable.updatedAt, new Date(lastSynced))));
    }

    const habits = await q.orderBy(asc(habitsTable.sortOrder), desc(habitsTable.createdAt));
    return { data: habits };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = habitSchema.safeParse(body);
    if (!validation.success) {
      return throwZodError(validation.error);
    }

    const result = await HabitService.createHabit(db, userId, validation.data, event);
    return { data: result };
  }
});
