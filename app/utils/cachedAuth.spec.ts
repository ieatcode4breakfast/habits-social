import { describe, expect, it, vi } from 'vitest';
import {
  AUTH_PENDING_SERVER_LOGOUT_KEY,
  AUTH_USER_STORAGE_KEY,
  cacheAuthUser,
  clearCachedAuthUser,
  clearPendingServerLogout,
  flushPendingServerLogout,
  getCachedAuthUser,
  hasCachedAuthUser,
  hasPendingServerLogout,
  markPendingServerLogout
} from './cachedAuth';

const createStorage = (value: string | null): Pick<Storage, 'getItem'> => ({
  getItem: (key: string): string | null => key === AUTH_USER_STORAGE_KEY ? value : null,
});

const createMutableStorage = (initial: Record<string, string> = {}): Storage => {
  const state = { ...initial };

  return {
    get length() {
      return Object.keys(state).length;
    },
    clear: () => {
      for (const key of Object.keys(state)) delete state[key];
    },
    getItem: (key: string) => state[key] ?? null,
    key: (index: number) => Object.keys(state)[index] ?? null,
    removeItem: (key: string) => {
      delete state[key];
    },
    setItem: (key: string, value: string) => {
      state[key] = value;
    },
  };
};

describe('hasCachedAuthUser', () => {
  it('returns true for a cached auth user with required profile fields', () => {
    const storage = createStorage(JSON.stringify({ id: 'user-1', email: 'u@example.com', username: 'user' }));

    expect(hasCachedAuthUser(storage)).toBe(true);
  });

  it('returns the cached auth user when it is valid', () => {
    const storage = createStorage(JSON.stringify({
      id: 'user-1',
      email: 'u@example.com',
      username: 'user',
      photoUrl: 'https://example.com/avatar.png'
    }));

    expect(getCachedAuthUser(storage)).toEqual({
      id: 'user-1',
      email: 'u@example.com',
      username: 'user',
      photoUrl: 'https://example.com/avatar.png'
    });
  });

  it('returns false when auth-user is missing', () => {
    expect(hasCachedAuthUser(createStorage(null))).toBe(false);
  });

  it('returns false when cached auth data is malformed JSON', () => {
    expect(hasCachedAuthUser(createStorage('{bad json'))).toBe(false);
  });

  it('returns false when cached auth data has no usable required fields', () => {
    expect(hasCachedAuthUser(createStorage(JSON.stringify({ id: 123 })))).toBe(false);
    expect(hasCachedAuthUser(createStorage(JSON.stringify({ id: '' })))).toBe(false);
    expect(hasCachedAuthUser(createStorage(JSON.stringify({ id: 'user-1', email: 123, username: 'user' })))).toBe(false);
    expect(hasCachedAuthUser(createStorage(JSON.stringify({ id: 'user-1', email: 'u@example.com', username: null })))).toBe(false);
  });

  it('does not expose cached auth while a server logout is pending', () => {
    const storage = createMutableStorage({
      [AUTH_USER_STORAGE_KEY]: JSON.stringify({ id: 'user-1', email: 'u@example.com', username: 'user' }),
      [AUTH_PENDING_SERVER_LOGOUT_KEY]: '1'
    });

    expect(hasCachedAuthUser(storage)).toBe(false);
    expect(getCachedAuthUser(storage)).toBeNull();
  });

  it('caches a fresh authenticated user and clears a pending logout marker', () => {
    const storage = createMutableStorage({
      [AUTH_PENDING_SERVER_LOGOUT_KEY]: '1'
    });

    cacheAuthUser(storage, { id: 'user-1', email: 'u@example.com', username: 'user' });

    expect(hasPendingServerLogout(storage)).toBe(false);
    expect(getCachedAuthUser(storage)?.id).toBe('user-1');
  });

  it('clears cached auth independently from the pending logout marker', () => {
    const storage = createMutableStorage({
      [AUTH_USER_STORAGE_KEY]: JSON.stringify({ id: 'user-1', email: 'u@example.com', username: 'user' }),
      [AUTH_PENDING_SERVER_LOGOUT_KEY]: '1'
    });

    clearCachedAuthUser(storage);

    expect(storage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(hasPendingServerLogout(storage)).toBe(true);
  });

  it('marks, flushes, and clears pending server logout only after successful server logout', async () => {
    const storage = createMutableStorage();
    const fetcher = vi.fn(async () => null);

    markPendingServerLogout(storage);
    expect(hasPendingServerLogout(storage)).toBe(true);

    await expect(flushPendingServerLogout(storage, fetcher)).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST', timeout: 3000 });
    expect(hasPendingServerLogout(storage)).toBe(false);
  });

  it('keeps pending server logout when server logout fails', async () => {
    const storage = createMutableStorage();
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    });

    markPendingServerLogout(storage);
    await expect(flushPendingServerLogout(storage, fetcher)).resolves.toBe(false);

    expect(hasPendingServerLogout(storage)).toBe(true);
    clearPendingServerLogout(storage);
    expect(hasPendingServerLogout(storage)).toBe(false);
  });
});
