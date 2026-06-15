import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { PushService } from '~~/server/services/push.service';
import { pushSubscriptionSchema } from './_utils';
import { throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const db = useDB(event);

  const body = await readBody(event);
  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[Push] Subscription validation failed:', JSON.stringify(parsed.error.issues, null, 2), 'body:', JSON.stringify(body));
    return throwZodError(parsed.error);
  }

  const { endpoint, keys, expirationTime, userAgent } = parsed.data;
  const headerUserAgent = userAgent || getHeader(event, 'user-agent') || null;
  const expTime = expirationTime ? new Date(expirationTime) : null;

  const sub = await PushService.upsertSubscription(
    db,
    userId,
    endpoint,
    keys.p256dh,
    keys.auth,
    expTime,
    headerUserAgent,
  );

  return { ok: true, id: sub.id };
});
