import { hash } from 'bcrypt-ts';
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { passwordResetTokens, users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { BCRYPT_COST_FACTOR } from '~~/server/utils/auth';
import { resetPasswordSchema, throwZodError } from '~~/server/utils/validation';
import { hashPasswordResetToken } from '~~/server/utils/passwordReset';
import { generalCheckRateLimit } from '~~/server/utils/generalRateLimit';

const RESET_COMPLETE_MESSAGE = 'Password has been reset successfully.';

export default defineEventHandler(async (event) => {
  const context = event.context as typeof event.context & {
    useDB?: typeof _useDB;
  };
  const useDB = context.useDB || _useDB;
  const db = useDB(event);
  // Rate limit by IP since this endpoint is unauthenticated (uses reset tokens)
  const ip = getHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown';
  await generalCheckRateLimit(event, ip, { maxPerIdentifier: 5, windowSeconds: 900 });

  const body = await readBody(event);
  const validation = resetPasswordSchema.safeParse(body);

  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { token, password } = validation.data;
  const tokenHash = await hashPasswordResetToken(token);
  const passwordHash = await hash(password, BCRYPT_COST_FACTOR);
  const now = new Date();

  const updatedToken = await db.transaction(async (tx) => {
    const [claimedToken] = await tx.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now)
      ))
      .returning({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId
      });

    if (!claimedToken) {
      return null;
    }

    await tx.update(users)
      .set({
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: now
      })
      .where(eq(users.id, claimedToken.userId));

    await tx.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.userId, claimedToken.userId),
        ne(passwordResetTokens.id, claimedToken.id),
        isNull(passwordResetTokens.usedAt)
      ));

    return claimedToken;
  });

  if (!updatedToken) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired password reset token' });
  }

  return { data: { message: RESET_COMPLETE_MESSAGE } };
});
