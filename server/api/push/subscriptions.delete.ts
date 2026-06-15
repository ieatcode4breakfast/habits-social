import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { PushService } from '~~/server/services/push.service';
import { pushDisableSchema } from './_utils';
import { throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const db = useDB(event);

  const body = await readBody(event);
  const parsed = pushDisableSchema.safeParse(body);
  if (!parsed.success) return throwZodError(parsed.error);

  const { endpoint } = parsed.data;

  await PushService.disableSubscription(db, userId, endpoint);

  return { ok: true };
});
