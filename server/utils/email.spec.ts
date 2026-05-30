import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface RuntimeConfigShape {
  resendApiKey: string;
  resendFromEmail: string;
  public: {
    appName: string;
  };
}

type PasswordResetEmailSender = (email: string, resetUrl: string) => Promise<void>;

const originalUseRuntimeConfig = (globalThis as { useRuntimeConfig?: unknown }).useRuntimeConfig;
const originalFetch = globalThis.fetch;

const getPasswordResetEmailSender = async (): Promise<PasswordResetEmailSender> => {
  const emailModulePath = './email';
  const emailModule = await import(emailModulePath) as Record<string, unknown>;
  const sender = emailModule.sendPasswordResetEmail;

  if (typeof sender !== 'function') {
    throw new Error('sendPasswordResetEmail must be exported from server/utils/email');
  }

  return sender as PasswordResetEmailSender;
};

const headerValue = (headers: HeadersInit | undefined, name: string): string | null => {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return entry?.[1] ?? null;
  }

  const record = headers as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()] ?? null;
};

describe('password reset email sender', () => {
  const runtimeConfig: RuntimeConfigShape = {
    resendApiKey: 're_test_secret_key',
    resendFromEmail: 'Habits Social <support@habitssocial.com>',
    public: {
      appName: 'Habits Social'
    }
  };

  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => runtimeConfig);
    vi.stubEnv('RESEND_API_KEY', runtimeConfig.resendApiKey);
    vi.stubEnv('RESEND_FROM_EMAIL', runtimeConfig.resendFromEmail);
  });

  afterEach(() => {
    vi.stubGlobal('useRuntimeConfig', originalUseRuntimeConfig);
    vi.stubGlobal('fetch', originalFetch);
    vi.unstubAllEnvs();
  });

  it('sends password reset email through Resend without using a live network call', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const sendPasswordResetEmail = await getPasswordResetEmailSender();
    await sendPasswordResetEmail('person@example.com', 'https://www.habitssocial.com/reset-password?token=abc123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(input)).toBe('https://api.resend.com/emails');
    expect(init?.method).toBe('POST');
    expect(headerValue(init?.headers, 'authorization')).toBe(`Bearer ${runtimeConfig.resendApiKey}`);

    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as Record<string, unknown>
      : {};

    expect(body.from).toBe(runtimeConfig.resendFromEmail);
    expect(body.to).toEqual(['person@example.com']);
    expect(String(body.subject)).toContain('Reset');
    expect(JSON.stringify(body)).toContain('https://www.habitssocial.com/reset-password?token=abc123');
  });

  it('throws a sanitized server error when Resend rejects the request', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ message: 'API key re_test_secret_key is invalid' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const sendPasswordResetEmail = await getPasswordResetEmailSender();

    let caughtError: unknown;
    try {
      await sendPasswordResetEmail('person@example.com', 'https://www.habitssocial.com/reset-password?token=abc123');
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeDefined();
    const serialized = JSON.stringify(caughtError);
    const message = caughtError instanceof Error ? caughtError.message : serialized;

    expect(serialized).not.toContain(runtimeConfig.resendApiKey);
    expect(message).not.toContain(runtimeConfig.resendApiKey);
    expect(message).toMatch(/email|send|delivery/i);
  });
});
