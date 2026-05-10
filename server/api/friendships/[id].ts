import { eq, and, or, sql } from 'drizzle-orm';
import { friendships, bucketHabits, buckets, habits, habitLogs } from '~~/server/db/schema';
import { useDB as _useDB, extractRows } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

import { SocialService } from '~~/server/services/social.service';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);
  const id = getRouterParam(event, 'id');
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ID format' });
  }

  if (event.method === 'PUT') {
    const result = await SocialService.acceptFriendship(db, userId, id, event);

    if (!result) {
      throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
    }

    return { data: result };
  }

  if (event.method === 'DELETE') {
    const success = await SocialService.removeFriendship(db, userId, id, event);
    
    if (!success) {
      throw createError({ statusCode: 403, statusMessage: 'Not authorized to delete this friendship' });
    }

    return { data: { success } };
  }
});
