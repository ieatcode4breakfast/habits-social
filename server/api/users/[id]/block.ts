import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { generalCheckRateLimit } from '~~/server/utils/generalRateLimit';
import { SocialService } from '~~/server/services/social.service';

type BlockRouteContext = {
  requireAuth?: typeof _requireAuth;
  useDB?: typeof _useDB;
};

export default defineEventHandler(async (event) => {
  const eventContext = event.context as typeof event.context & BlockRouteContext;
  const requireAuth = eventContext.requireAuth ?? _requireAuth;
  const useDB = eventContext.useDB ?? _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);
  await generalCheckRateLimit(event, userId);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' });
  }

  if (event.method === 'POST') {
    const block = await SocialService.blockUser(db, userId, id);
    return {
      data: {
        blocked: true,
        blockerId: block.blockerId,
        blockedId: block.blockedId
      }
    };
  }

  if (event.method === 'DELETE') {
    await SocialService.unblockUser(db, userId, id);
    return { data: { blocked: false } };
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
});
