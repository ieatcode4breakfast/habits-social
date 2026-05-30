import { eq, sql } from 'drizzle-orm';
import { users, passwordResetTokens } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { forgotPasswordSchema, throwZodError } from '~~/server/utils/validation';
import { checkRateLimit } from '~~/server/utils/rateLimit';
import { sendPasswordResetEmail as _sendPasswordResetEmail } from '~~/server/utils/email';
import type { H3Event } from 'h3';
import {
  PASSWORD_RESET_SUCCESS_MESSAGE,
  PASSWORD_RESET_TOKEN_TTL_MS,
  buildPasswordResetUrl,
  generatePasswordResetToken,
  hashPasswordResetToken
} from '~~/server/utils/passwordReset';

type PasswordResetEmailSender = (email: string, resetUrl: string) => Promise<void>;

interface ForgotPasswordRuntimeConfig {
  appUrl?: string;
}

const getAppUrl = (event: H3Event): string => {
  let config: ForgotPasswordRuntimeConfig = {};
  try {
    config = useRuntimeConfig(event) as ForgotPasswordRuntimeConfig;
  } catch {
    config = {};
  }

  const eventContext = event?.context as { cloudflare?: { env?: Record<string, string | undefined> } } | undefined;
  return eventContext?.cloudflare?.env?.APP_URL
    || eventContext?.cloudflare?.env?.NUXT_PUBLIC_APP_URL
    || config.appUrl
    || process.env.APP_URL
    || process.env.NUXT_PUBLIC_APP_URL
    || 'https://www.habitssocial.com';
};

export default defineEventHandler(async (event) => {
  const context = event.context as typeof event.context & {
    useDB?: typeof _useDB;
    sendPasswordResetEmail?: PasswordResetEmailSender;
  };
  const useDB = context.useDB || _useDB;
  const sendPasswordResetEmail = context.sendPasswordResetEmail || ((email: string, resetUrl: string) => _sendPasswordResetEmail(email, resetUrl, event));
  const db = useDB(event);

  const body = await readBody(event);
  const validation = forgotPasswordSchema.safeParse(body);

  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const email = validation.data.email.toLowerCase();

  await checkRateLimit(event, email);

  const [user] = await db.select({
    id: users.id,
    email: users.email
  })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  if (!user) {
    return { data: { message: PASSWORD_RESET_SUCCESS_MESSAGE } };
  }

  const rawToken = generatePasswordResetToken();
  const tokenHash = await hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    await tx.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(sql`${passwordResetTokens.userId} = ${user.id} AND ${passwordResetTokens.usedAt} IS NULL`);

    await tx.insert(passwordResetTokens).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: new Date()
    });
  });

  const resetUrl = buildPasswordResetUrl(getAppUrl(event), rawToken);

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (error) {
    console.error('Password reset email failed:', error);
  }

  return { data: { message: PASSWORD_RESET_SUCCESS_MESSAGE } };
});
