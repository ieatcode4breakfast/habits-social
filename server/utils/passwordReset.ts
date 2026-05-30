export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_SUCCESS_MESSAGE = 'If an account exists for that email, password reset instructions have been sent.';

export const generatePasswordResetToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const hashPasswordResetToken = async (token: string): Promise<string> => {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const buildPasswordResetUrl = (appUrl: string, token: string): string => {
  const url = new URL('/reset-password', appUrl);
  url.searchParams.set('token', token);
  return url.toString();
};
