import type { H3Event } from 'h3';

interface EmailRuntimeConfig {
  resendApiKey?: string;
  resendFromEmail?: string;
  public?: {
    appName?: string;
  };
}

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const getEmailConfig = (event?: H3Event): Required<Pick<EmailRuntimeConfig, 'resendApiKey' | 'resendFromEmail'>> & { appName: string } => {
  let config: EmailRuntimeConfig = {};
  try {
    config = useRuntimeConfig(event) as EmailRuntimeConfig;
  } catch {
    config = {};
  }

  const eventContext = event?.context as { cloudflare?: { env?: Record<string, string | undefined> } } | undefined;
  const cf = eventContext?.cloudflare?.env;
  const resendApiKey = cf?.RESEND_API_KEY || process.env.RESEND_API_KEY || config.resendApiKey;
  const resendFromEmail = cf?.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || config.resendFromEmail || 'Habits Social <noreply@habitssocial.com>';
  const appName = config.public?.appName || process.env.APP_NAME || 'Habits Social';

  if (!resendApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'Email delivery is not configured' });
  }

  return { resendApiKey, resendFromEmail, appName };
};

export const sendPasswordResetEmail = async (email: string, resetUrl: string, event?: H3Event): Promise<void> => {
  const { resendApiKey, resendFromEmail, appName } = getEmailConfig(event);
  const escapedResetUrl = escapeHtml(resetUrl);
  const escapedAppName = escapeHtml(appName);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
      'user-agent': 'habits-social-password-reset'
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [email],
      subject: `Reset your ${appName} password`,
      text: `Use this link to reset your ${appName} password: ${resetUrl}\n\nThis link expires in 15 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Use this link to reset your ${escapedAppName} password:</p><p><a href="${escapedResetUrl}">Reset password</a></p><p>This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>`
    })
  });

  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Email delivery failed' });
  }
};
