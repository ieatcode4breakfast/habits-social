import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { friendIdSchema, chatMessageSchema, throwZodError } from '~~/server/utils/validation';
import { checkChatRateLimit } from '~~/server/utils/chatRateLimit';

/**
 * Extracts the Cloudflare execution context's `waitUntil` from the H3 event.
 *
 * In Cloudflare Workers + Nitro, the execution context lives at
 * `event.context.cloudflare.context`, NOT on the event object itself.
 * Registering async work (e.g. push delivery) via this mechanism keeps the
 * worker alive past the HTTP response, preventing silent promise cancellation.
 */
const getCfWaitUntil = (event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never): ((promise: Promise<unknown>) => void) | undefined => {
  const cfCtx = (event.context as Record<string, unknown>)?.cloudflare as Record<string, unknown> | undefined;
  const execCtx = cfCtx?.context as Record<string, unknown> | undefined;
  if (typeof execCtx?.waitUntil === 'function') {
    return (execCtx.waitUntil as (p: Promise<unknown>) => void).bind(execCtx);
  }
  return undefined;
};

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

    // Extract CF waitUntil so push delivery outlives the HTTP response
    const waitUntil = getCfWaitUntil(event);

    return await ChatService.sendMessage(
      db, userId, conv.id,
      bodyValidation.data.body,
      bodyValidation.data.replyToActivity,
      waitUntil,
    );
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
