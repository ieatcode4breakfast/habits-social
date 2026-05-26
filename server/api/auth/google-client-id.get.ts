import { getGoogleClientId } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const clientId = getGoogleClientId(event);
  return { clientId };
});
