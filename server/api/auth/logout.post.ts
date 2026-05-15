import { AUTH_COOKIE_NAME } from '~~/server/utils/auth';

export default defineEventHandler((event) => {
  deleteCookie(event, AUTH_COOKIE_NAME, {
    path: '/'
  });
  return { data: { success: true } };
});
