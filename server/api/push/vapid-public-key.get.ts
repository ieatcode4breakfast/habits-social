import { requireAuth } from '~~/server/utils/auth';
import { getPushRuntimeConfig } from './_utils';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const config = getPushRuntimeConfig();
  const publicKey = config.public?.vapidPublicKey || process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = config.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || '';
  const supported = !!publicKey && !!privateKey;
  return { supported, publicKey: supported ? publicKey : undefined };
});
