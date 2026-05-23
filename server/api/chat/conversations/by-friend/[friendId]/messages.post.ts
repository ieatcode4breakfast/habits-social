import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { friendIdSchema, chatMessageSchema, throwZodError } from '~~/server/utils/validation';
import { checkChatRateLimit } from '~~/server/utils/chatRateLimit';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const friendIdParam = getRouterParam(event, 'friendId');
  const friendIdValidation = friendIdSchema.safeParse(friendIdParam);
  if (!friendIdValidation.success) return throwZodError(friendIdValidation.error);

  await checkChatRateLimit(event, userId, friendIdValidation.data);
  
  const db = useDB(event);

  const body = await readBody(event);
  const bodyValidation = chatMessageSchema.safeParse(body);
  if (!bodyValidation.success) return throwZodError(bodyValidation.error);

  try {
    const conv = await ChatService.getOrCreateConversationForFriend(db, userId, friendIdValidation.data);
    if (!conv) throw new Error('Could not create conversation');
    return await ChatService.sendMessage(db, userId, conv.id, bodyValidation.data.body, bodyValidation.data.replyToActivity);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
