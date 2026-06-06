import { describe, expect, it } from 'vitest';
import { AUTH_USER_STORAGE_KEY, getCachedAuthUser, hasCachedAuthUser } from './cachedAuth';

const createStorage = (value: string | null): Pick<Storage, 'getItem'> => ({
  getItem: (key: string): string | null => key === AUTH_USER_STORAGE_KEY ? value : null,
});

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
});
