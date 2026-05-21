import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { checkChatReadRateLimit } from '~~/server/utils/chatRateLimit';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkChatReadRateLimit(event, userId);
  const db = useDB(event);

  return await ChatService.listConversations(db, userId);
});
