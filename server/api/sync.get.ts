import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { SyncService } from '~~/server/services/sync.service';
import { syncQuerySchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);
  const rawQuery = getQuery(event);

  const validation = syncQuerySchema.safeParse(rawQuery);
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const query = validation.data;

  return await SyncService.getPaginatedDeltas(db, userId, query);
});
