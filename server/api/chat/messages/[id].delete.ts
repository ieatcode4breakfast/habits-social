import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { checkChatRateLimit } from '~~/server/utils/chatRateLimit';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkChatRateLimit(event, userId, 'delete_msg');
  const db = useDB(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Message ID is required' });
  }

  try {
    await ChatService.deleteMessage(db, userId, id);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
