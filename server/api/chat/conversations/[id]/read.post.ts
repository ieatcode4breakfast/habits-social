import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { conversationIdSchema, throwZodError } from '~~/server/utils/validation';
import { checkChatReadRateLimit } from '~~/server/utils/chatRateLimit';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkChatReadRateLimit(event, userId);
  const db = useDB(event);

  const idParam = getRouterParam(event, 'id');
  const idValidation = conversationIdSchema.safeParse(idParam);
  if (!idValidation.success) return throwZodError(idValidation.error);

  try {
    await ChatService.markAsRead(db, userId, idValidation.data);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
