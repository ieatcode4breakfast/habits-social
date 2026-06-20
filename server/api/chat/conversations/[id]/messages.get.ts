import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { throwZodError } from '~~/server/utils/validation';
import { checkChatReadRateLimit } from '~~/server/utils/chatRateLimit';
import { z } from 'zod';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkChatReadRateLimit(event, userId);
  const db = useDB(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation ID is required' });
  }

  const query = getQuery(event);
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().optional()
  });
  const queryValidation = querySchema.safeParse(query);
  if (!queryValidation.success) return throwZodError(queryValidation.error);

  try {
    return await ChatService.listMessages(db, userId, id, queryValidation.data);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
