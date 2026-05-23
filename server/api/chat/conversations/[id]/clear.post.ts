import { defineEventHandler, createError, getRouterParam } from 'h3';
import { requireAuth } from '../../../../utils/auth';
import { checkChatClearRateLimit } from '../../../../utils/chatRateLimit';
import { ChatService } from '../../../../services/chat.service';
import { useDB } from '../../../../utils/db';

export default defineEventHandler(async (event) => {
  // 1. Authenticate user context (throws 401)
  const userId = await requireAuth(event);

  // 2. Validate route param
  const conversationId = getRouterParam(event, 'id');
  if (!conversationId) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation ID is required' });
  }
  
  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Conversation ID format' });
  }

  // 3. Rate Limit
  await checkChatClearRateLimit(event, userId);

  // 4. Service Call
  const db = useDB();
  try {
    await ChatService.clearConversation(db, userId, conversationId);
    return { success: true };
  } catch (error: any) {
    // Strict error handling contract: explicit 401, 400, 429, 500 pass-through
    if (error.statusCode === 401 || error.statusCode === 400 || error.statusCode === 429 || error.statusCode === 500) {
      throw error;
    }
    
    // Normal authorization/service failures without predefined status become 403
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
});
