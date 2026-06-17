import { requireAuth } from '~~/server/utils/auth';
import { getVapidConfig } from '~~/server/services/push.service';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const config = getVapidConfig();
  return { supported: !!config, publicKey: config?.publicKey };
});
