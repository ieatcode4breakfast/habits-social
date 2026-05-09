import { eq, and, gte, asc, desc, sql } from 'drizzle-orm';
import { habits as habitsTable } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { habitSchema, throwZodError } from '~~/server/utils/validation';

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

    const data = validation.data;
    const nextSortOrder = data.sortOrder !== undefined ? data.sortOrder : 0;

    if (nextSortOrder >= 30) {
      throw createError({ statusCode: 400, statusMessage: 'Habit limit of 30 reached' });
    }

    let skipsCount = data.skipsCount ?? 2;
    const skipsPeriod = data.skipsPeriod ?? 'weekly';
    if (skipsPeriod === 'none') {
      skipsCount = 0;
    } else if (skipsPeriod === 'weekly') {
      skipsCount = Math.max(0, Math.min(6, skipsCount));
    } else if (skipsPeriod === 'monthly') {
      skipsCount = Math.max(0, Math.min(28, skipsCount));
    }

    const habitId = data.id || crypto.randomUUID();

    const result = await db.insert(habitsTable)
      .values({
        id: habitId,
        ownerId: userId,
        title: data.title,
        description: data.description || '',
        skipsCount: skipsCount,
        skipsPeriod: skipsPeriod,
        color: data.color || '#6366f1',
        sharedWith: data.sharedWith || [],
        sortOrder: nextSortOrder,
        userDate: data.userDate || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: habitsTable.id,
        set: {
          title: data.title,
          description: data.description || '',
          skipsCount: skipsCount,
          skipsPeriod: skipsPeriod,
          color: data.color || '#6366f1',
          sharedWith: data.sharedWith || [],
          sortOrder: nextSortOrder,
          userDate: data.userDate || null,
          updatedAt: new Date()
        },
        where: eq(habitsTable.ownerId, userId)
      })
      .returning();

    if (!result[0]) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create habit' });
    }

    return { data: result[0] };
  }
});
