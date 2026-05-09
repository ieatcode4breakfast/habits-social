import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { SyncService } from '~~/server/services/sync.service';
import { syncV2QuerySchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);
  const rawQuery = getQuery(event);

  const validation = syncV2QuerySchema.safeParse(rawQuery);
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const query = validation.data;

  return await SyncService.getPaginatedDeltas(db, userId, query);
});
