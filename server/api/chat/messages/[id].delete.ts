import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { messageIdSchema, throwZodError } from '~~/server/utils/validation';
import { checkChatRateLimit } from '~~/server/utils/chatRateLimit';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkChatRateLimit(event, userId, 'delete_msg');
  const db = useDB(event);

  const idParam = getRouterParam(event, 'id');
  const idValidation = messageIdSchema.safeParse(idParam);
  if (!idValidation.success) return throwZodError(idValidation.error);

  try {
    await ChatService.deleteMessage(db, userId, idValidation.data);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
