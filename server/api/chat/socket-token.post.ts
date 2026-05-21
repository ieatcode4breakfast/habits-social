import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { ChatService } from '~~/server/services/chat.service';
import { conversationIdSchema, throwZodError } from '~~/server/utils/validation';
import { checkChatTokenRateLimit } from '~~/server/utils/chatRateLimit';
import { SignJWT } from 'jose';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkChatTokenRateLimit(event, userId);
  const db = useDB(event);

  const body = await readBody(event);
  const convIdValidation = conversationIdSchema.safeParse(body?.conversationId);
  if (!convIdValidation.success) return throwZodError(convIdValidation.error);

  const conversationId = convIdValidation.data;

  try {
    // Verifies active friendship and membership
    await ChatService.verifyAccess(db, userId, conversationId);

    const globalCtx = globalThis as { useRuntimeConfig?: (e: any) => { jwtSecret: string } };
    const config = globalCtx.useRuntimeConfig ? globalCtx.useRuntimeConfig(event) : useRuntimeConfig(event);
    const secret = new TextEncoder().encode(config.jwtSecret);
    
    const token = await new SignJWT({ userId, conversationId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);

    return { token };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode === 429 ? 429 : 403,
      statusMessage: error.message || 'Forbidden'
    });
  }
});
