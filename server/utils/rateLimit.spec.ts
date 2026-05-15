import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimit } from './rateLimit';
import { createError } from 'h3';

// Mock h3 functions if not already mocked by vitest environment
if (!(global as any).createError) {
  (global as any).createError = createError;
}

const mockHeaders: Record<string, string> = {};
if (!(global as any).setResponseHeader) {
  (global as any).setResponseHeader = vi.fn((event, name, value) => {
    mockHeaders[name.toLowerCase()] = value;
  });
}

if (!(global as any).getRequestIP) {
  (global as any).getRequestIP = vi.fn((event) => event._ip || '127.0.0.1');
}

// Mock Nitro storage
const storageMock: Record<string, any> = {};
const storageInstances: Record<string, any> = {};
if (!(global as any).useStorage) {
  (global as any).useStorage = vi.fn((base: string) => {
    if (!storageInstances[base]) {
      storageInstances[base] = {
        getItem: async (key: string) => storageMock[`${base}:${key}`] || null,
        setItem: async (key: string, value: any) => { storageMock[`${base}:${key}`] = value; },
        removeItem: async (key: string) => { delete storageMock[`${base}:${key}`]; },
        clear: async () => { for (const key in storageMock) { if (key.startsWith(base + ':')) delete storageMock[key]; } }
      };
    }
    return storageInstances[base];
  });
}

describe('rateLimit utility', () => {
  beforeEach(() => {
    for (const key in storageMock) delete storageMock[key];
    for (const key in mockHeaders) delete mockHeaders[key];
    vi.clearAllMocks();
  });

  it('should allow requests within limits', async () => {
    const event = { _ip: '1.1.1.1' } as any;
    await expect(checkRateLimit(event, 'user@example.com')).resolves.not.toThrow();
  });

  it('should throw 429 when identifier limit is reached', async () => {
    const event = { _ip: '1.1.1.1' } as any;
    const identifier = 'user@example.com';

    // 5 attempts are allowed (but increment the counter)
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(event, identifier);
    }

    // 6th attempt should fail
    await expect(checkRateLimit(event, identifier)).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: expect.stringContaining('Too many requests')
    });
    
    expect(mockHeaders['retry-after']).toBeDefined();
  });

  it('should throw 429 when IP limit is reached', async () => {
    const event = { _ip: '1.1.1.1' } as any;

    // 50 attempts from same IP with different identifiers
    for (let i = 0; i < 50; i++) {
      await checkRateLimit(event, `user${i}@example.com`);
    }

    // 51st attempt should fail even with new identifier
    await expect(checkRateLimit(event, 'other@example.com')).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: expect.stringContaining('Too many requests from this IP')
    });
  });

  it('should be case-insensitive for identifiers', async () => {
    const event = { _ip: '1.1.1.1' } as any;
    const identifierUpper = 'USER@EXAMPLE.COM';
    const identifierLower = 'user@example.com';

    for (let i = 0; i < 5; i++) {
      await checkRateLimit(event, identifierUpper);
    }

    await expect(checkRateLimit(event, identifierLower)).rejects.toMatchObject({
      statusCode: 429
    });
  });

  it('should reset identifier limit', async () => {
    const event = { _ip: '1.1.1.1' } as any;
    const identifier = 'user@example.com';

    for (let i = 0; i < 5; i++) {
      await checkRateLimit(event, identifier);
    }

    await expect(checkRateLimit(event, identifier)).rejects.toThrow();

    await resetRateLimit(event, identifier);

    await expect(checkRateLimit(event, identifier)).resolves.not.toThrow();
  });

  it('should fail-closed on storage error', async () => {
    const event = { _ip: '1.1.1.1' } as any;
    const storage = (global as any).useStorage('authRateLimit');
    vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('DB Down'));

    await expect(checkRateLimit(event, 'user@example.com')).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: expect.stringContaining('Internal security error')
    });
  });
});
