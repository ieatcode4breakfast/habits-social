import './setup';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createMockEvent, createTestUser, db, deleteTestUser } from './test.utils';

const RESET_SUCCESS_MESSAGE = 'If an account exists for that email, password reset instructions have been sent.';

interface EndpointResponse {
  data?: unknown;
}

interface PasswordResetEmailCall {
  email: string;
  resetUrl: string;
}

interface PasswordResetTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date | string;
  usedAt: Date | string | null;
  createdAt: Date | string;
}

interface CountRow {
  count: string | number;
}

interface TestEventContext {
  userId?: string;
  sendPasswordResetEmail?: (email: string, resetUrl: string) => Promise<void>;
}

interface TestEvent {
  _headers?: Record<string, string>;
  context: TestEventContext;
}

type EventHandler = (event: TestEvent) => Promise<EndpointResponse>;

const sentEmails: PasswordResetEmailCall[] = [];
const sendPasswordResetEmail = vi.fn(async (email: string, resetUrl: string): Promise<void> => {
  sentEmails.push({ email, resetUrl });
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractRows = <T>(result: unknown): T[] => {
  if (Array.isArray(result)) return result as T[];
  if (isRecord(result) && Array.isArray(result.rows)) return result.rows as T[];
  return [];
};

const responseMessage = (response: EndpointResponse): string | undefined => {
  if (!isRecord(response.data)) return undefined;
  const message = response.data.message;
  return typeof message === 'string' ? message : undefined;
};

const hashResetToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const createPasswordResetEvent = (body: unknown, ip = '10.1.1.1'): TestEvent => {
  const event = createMockEvent('', body, {}, {}, {}, 'POST', ip) as unknown as TestEvent;
  event.context.sendPasswordResetEmail = sendPasswordResetEmail;
  return event;
};

const latestSentToken = (): string => {
  const lastEmail = sentEmails.at(-1);
  expect(lastEmail).toBeDefined();
  const resetUrl = lastEmail?.resetUrl;
  expect(resetUrl).toEqual(expect.stringContaining('token='));

  const token = new URL(resetUrl ?? 'https://example.com/reset-password').searchParams.get('token');
  expect(token).toEqual(expect.any(String));
  if (!token) throw new Error('Expected password reset email URL to include a token query parameter');
  return token;
};

const selectTokenRowsForUser = async (userId: string): Promise<PasswordResetTokenRow[]> => {
  const result = await db.execute(sql`
    SELECT
      id,
      user_id AS "userId",
      token_hash AS "tokenHash",
      expires_at AS "expiresAt",
      used_at AS "usedAt",
      created_at AS "createdAt"
    FROM password_reset_tokens
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `);

  return extractRows<PasswordResetTokenRow>(result);
};

const countPasswordResetTokens = async (): Promise<number> => {
  const result = await db.execute(sql`SELECT COUNT(*) AS count FROM password_reset_tokens`);
  const [row] = extractRows<CountRow>(result);
  return Number(row?.count ?? 0);
};

const deleteTokenRowsForUser = async (userId: string): Promise<void> => {
  try {
    await db.execute(sql`DELETE FROM password_reset_tokens WHERE user_id = ${userId}`);
  } catch {
    // The table does not exist until the feature implementation lands.
  }
};

const seedPasswordResetToken = async (
  userId: string,
  rawToken: string,
  expiresAt: Date,
  usedAt: Date | null = null
): Promise<void> => {
  await db.execute(sql`
    INSERT INTO password_reset_tokens (
      id,
      user_id,
      token_hash,
      expires_at,
      used_at,
      created_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${hashResetToken(rawToken)},
      ${expiresAt},
      ${usedAt},
      NOW()
    )
  `);
};

describe('Password reset backend flow', () => {
  let forgotPasswordHandler: EventHandler;
  let resetPasswordHandler: EventHandler;
  let loginHandler: EventHandler;
  let createdUserIds: string[] = [];

  beforeAll(async () => {
    const forgotPasswordRoute = '../api/auth/forgot-password.post';
    const resetPasswordRoute = '../api/auth/reset-password.post';
    const loginRoute = '../api/auth/login.post';

    forgotPasswordHandler = (await import(forgotPasswordRoute)).default as EventHandler;
    resetPasswordHandler = (await import(resetPasswordRoute)).default as EventHandler;
    loginHandler = (await import(loginRoute)).default as EventHandler;
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    sendPasswordResetEmail.mockClear();
    const storage = useStorage('authRateLimit');
    await storage.clear();
  });

  afterEach(async () => {
    for (const userId of createdUserIds) {
      await deleteTokenRowsForUser(userId);
      await deleteTestUser(userId);
    }
    createdUserIds = [];
  });

  const createResetUser = async () => {
    const unique = crypto.randomUUID().slice(0, 8);
    const user = await createTestUser(`pwreset_${unique}`, `pwreset_${unique}@example.com`);
    createdUserIds.push(user.id);
    return user;
  };

  const requestForgotPassword = async (email: string, ip?: string): Promise<EndpointResponse> => {
    const event = createPasswordResetEvent({ email }, ip);
    return await forgotPasswordHandler(event);
  };

  const submitResetPassword = async (token: string, password = 'newpassword123'): Promise<EndpointResponse> => {
    const event = createPasswordResetEvent({ token, password }, '10.2.2.2');
    return await resetPasswordHandler(event);
  };

  const loginWithPassword = async (identifier: string, password: string): Promise<EndpointResponse> => {
    const event = createMockEvent('', { identifier, password }, {}, {}, {}, 'POST', '10.3.3.3') as unknown as TestEvent;
    return await loginHandler(event);
  };

  describe('POST /api/auth/forgot-password', () => {
    it('returns the same generic response for registered and unknown emails', async () => {
      const user = await createResetUser();

      const existingResponse = await requestForgotPassword(user.email, '10.10.10.1');
      const unknownResponse = await requestForgotPassword(`missing_${crypto.randomUUID()}@example.com`, '10.10.10.2');

      expect(responseMessage(existingResponse)).toBe(RESET_SUCCESS_MESSAGE);
      expect(responseMessage(unknownResponse)).toBe(RESET_SUCCESS_MESSAGE);
      expect(existingResponse).toEqual(unknownResponse);
    });

    it('creates one hashed reset token and sends one email for an existing account', async () => {
      const user = await createResetUser();

      await requestForgotPassword(user.email);

      const rawToken = latestSentToken();
      const rows = await selectTokenRowsForUser(user.id);

      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(sentEmails[0]?.email).toBe(user.email);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.userId).toBe(user.id);
      expect(rows[0]?.tokenHash).toBe(hashResetToken(rawToken));
      expect(rows[0]?.tokenHash).not.toBe(rawToken);
      expect(rows[0]?.expiresAt).toBeDefined();
      expect(rows[0]?.usedAt).toBeNull();
    });

    it('does not send email or create reset material for an unknown account', async () => {
      const beforeCount = await countPasswordResetTokens();

      const response = await requestForgotPassword(`unknown_${crypto.randomUUID()}@example.com`);

      const afterCount = await countPasswordResetTokens();
      expect(responseMessage(response)).toBe(RESET_SUCCESS_MESSAGE);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(afterCount).toBe(beforeCount);
    });

    it('invalidates older unused tokens when a new reset is requested', async () => {
      const user = await createResetUser();

      await requestForgotPassword(user.email);
      const firstToken = latestSentToken();

      await requestForgotPassword(user.email);
      const secondToken = latestSentToken();

      await expect(submitResetPassword(firstToken)).rejects.toMatchObject({
        statusCode: 400
      });
      await expect(submitResetPassword(secondToken)).resolves.toBeDefined();
    });

    it('rate limits repeated reset requests for the same email', async () => {
      const user = await createResetUser();
      const bodyEmail = user.email;

      for (let index = 0; index < 5; index++) {
        await expect(requestForgotPassword(bodyEmail, '10.20.20.1')).resolves.toBeDefined();
      }

      await expect(requestForgotPassword(bodyEmail, '10.20.20.1')).rejects.toMatchObject({
        statusCode: 429,
        statusMessage: expect.stringContaining('Too many requests')
      });
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('updates the password, rejects the old password, and marks the token as used', async () => {
      const user = await createResetUser();
      await requestForgotPassword(user.email);
      const token = latestSentToken();

      const response = await submitResetPassword(token, 'newpassword123');

      await expect(loginWithPassword(user.email, 'newpassword123')).resolves.toBeDefined();
      await expect(loginWithPassword(user.email, 'password123')).rejects.toThrow(/Invalid username/i);

      const rows = await selectTokenRowsForUser(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.usedAt).not.toBeNull();
      expect(JSON.stringify(response)).not.toContain('passwordHash');
      expect(JSON.stringify(response)).not.toContain('tokenHash');
      expect(JSON.stringify(response)).not.toContain(token);
    });

    it('rejects token reuse', async () => {
      const user = await createResetUser();
      await requestForgotPassword(user.email);
      const token = latestSentToken();

      await expect(submitResetPassword(token, 'newpassword123')).resolves.toBeDefined();
      await expect(submitResetPassword(token, 'anotherpassword123')).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('rejects expired tokens without changing the password', async () => {
      const user = await createResetUser();
      const token = `expired-${crypto.randomUUID()}`;

      await seedPasswordResetToken(user.id, token, new Date(Date.now() - 60_000));

      await expect(submitResetPassword(token, 'newpassword123')).rejects.toMatchObject({
        statusCode: 400
      });
      await expect(loginWithPassword(user.email, 'password123')).resolves.toBeDefined();
    });

    it('rejects used tokens even if they have not expired', async () => {
      const user = await createResetUser();
      const token = `used-${crypto.randomUUID()}`;

      await seedPasswordResetToken(user.id, token, new Date(Date.now() + 900_000), new Date());

      await expect(submitResetPassword(token, 'newpassword123')).rejects.toMatchObject({
        statusCode: 400
      });
      await expect(loginWithPassword(user.email, 'password123')).resolves.toBeDefined();
    });

    it('rejects unknown, empty, and oversized tokens', async () => {
      await expect(submitResetPassword(`unknown-${crypto.randomUUID()}`)).rejects.toMatchObject({
        statusCode: 400
      });
      await expect(submitResetPassword('')).rejects.toMatchObject({
        statusCode: 400
      });
      await expect(submitResetPassword('x'.repeat(4097))).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('invalidates every other active token for the user after a successful reset', async () => {
      const user = await createResetUser();

      const olderToken = `older-${crypto.randomUUID()}`;
      const newerToken = `newer-${crypto.randomUUID()}`;
      await seedPasswordResetToken(user.id, olderToken, new Date(Date.now() + 900_000));
      await seedPasswordResetToken(user.id, newerToken, new Date(Date.now() + 900_000));

      await expect(submitResetPassword(newerToken, 'newpassword123')).resolves.toBeDefined();
      await expect(submitResetPassword(olderToken, 'anotherpassword123')).rejects.toMatchObject({
        statusCode: 400
      });
    });
  });
});
