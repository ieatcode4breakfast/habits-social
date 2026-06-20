import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { checkChatReadRateLimit } from '~~/server/utils/chatRateLimit';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkChatReadRateLimit(event, userId);
  const db = useDB(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation ID is required' });
  }

  try {
    await ChatService.markAsRead(db, userId, id);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
