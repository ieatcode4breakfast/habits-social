import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generalCheckRateLimit } from './generalRateLimit';
import { createError } from 'h3';

// Mock h3 functions if not already mocked by vitest environment
if (!(global as any).createError) {
  (global as any).createError = createError;
}

const mockHeaders: Record<string, string> = {};
if (!(global as any).setResponseHeader) {
  (global as any).setResponseHeader = vi.fn((_event: any, name: string, value: string) => {
    mockHeaders[name.toLowerCase()] = value;
  });
}

if (!(global as any).getRequestIP) {
  (global as any).getRequestIP = vi.fn((event: any) => event._ip || '127.0.0.1');
}

// Mock Nitro storage for generalRateLimit
const storageMock: Record<string, any> = {};
const storageInstances: Record<string, any> = {};
if (!(global as any).useStorage) {
  (global as any).useStorage = vi.fn((base: string) => {
    if (!storageInstances[base]) {
      storageInstances[base] = {
        getItem: async (key: string) => storageMock[`${base}:${key}`] || null,
        setItem: async (key: string, value: any) => {
          storageMock[`${base}:${key}`] = value;
        },
        removeItem: async (key: string) => {
          delete storageMock[`${base}:${key}`];
        },
        clear: async () => {
          for (const key in storageMock) {
            if (key.startsWith(base + ':')) delete storageMock[key];
          }
        },
      };
    }
    return storageInstances[base];
  });
}

describe('generalRateLimit utility', () => {
  beforeEach(() => {
    for (const key in storageMock) delete storageMock[key];
    for (const key in mockHeaders) delete mockHeaders[key];
    vi.clearAllMocks();
  });

  it('should allow requests within default limits', async () => {
    const event = { _ip: '1.1.1.1', _getRequestIP: () => '1.1.1.1' } as any;
    for (let i = 0; i < 30; i++) {
      await expect(generalCheckRateLimit(event, 'user-123')).resolves.not.toThrow();
    }
  });

  it('should throw 429 when identifier limit is reached (default 30)', async () => {
    const event = { _ip: '1.1.1.1', _getRequestIP: () => '1.1.1.1' } as any;
    const identifier = 'user-123';

    // 30 attempts are allowed
    for (let i = 0; i < 30; i++) {
      await generalCheckRateLimit(event, identifier);
    }

    // 31st attempt should fail
    await expect(generalCheckRateLimit(event, identifier)).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: expect.stringContaining('Too many requests'),
    });

    expect(mockHeaders['retry-after']).toBeDefined();
  });

  it('should throw 429 when IP limit is reached (default 100)', async () => {
    const event = { _ip: '1.1.1.1', _getRequestIP: () => '1.1.1.1' } as any;

    // 100 attempts from same IP with different identifiers
    for (let i = 0; i < 100; i++) {
      await generalCheckRateLimit(event, `user-${i}`);
    }

    // 101st attempt should fail even with new identifier
    await expect(generalCheckRateLimit(event, 'another-user')).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: expect.stringContaining('Too many requests from this IP'),
    });
  });

  it('should be case-insensitive for identifiers', async () => {
    const event = { _ip: '1.1.1.1', _getRequestIP: () => '1.1.1.1' } as any;

    for (let i = 0; i < 30; i++) {
      await generalCheckRateLimit(event, 'USER-ABC');
    }

    await expect(generalCheckRateLimit(event, 'user-abc')).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it('should respect custom maxPerIdentifier override', async () => {
    const event = { _ip: '1.1.1.1', _getRequestIP: () => '1.1.1.1' } as any;
    const identifier = 'user-low-limit';

    // Custom limit of 5
    for (let i = 0; i < 5; i++) {
      await generalCheckRateLimit(event, identifier, { maxPerIdentifier: 5 });
    }

    await expect(
      generalCheckRateLimit(event, identifier, { maxPerIdentifier: 5 }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it('should respect custom windowSeconds override', async () => {
    const event = { _ip: '1.1.1.1', _getRequestIP: () => '1.1.1.1' } as any;
    const identifier = 'user-short-window';

    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      await generalCheckRateLimit(event, identifier, { maxPerIdentifier: 5, windowSeconds: 1 });
    }

    await expect(
      generalCheckRateLimit(event, identifier, { maxPerIdentifier: 5, windowSeconds: 1 }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it('should fail-closed on storage error returning 500', async () => {
    const event = { _ip: '1.1.1.1', _getRequestIP: () => '1.1.1.1' } as any;
    const storage = (global as any).useStorage('generalRateLimit');
    vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('DB Down'));

    await expect(generalCheckRateLimit(event, 'user-123')).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: expect.stringContaining('Internal security error'),
    });
  });
});
