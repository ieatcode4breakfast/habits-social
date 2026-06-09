import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ref } from 'vue';
import { useAuth } from './useAuth';
import {
  cacheAuthUser,
  getCachedAuthUser,
  AUTH_PENDING_SERVER_LOGOUT_KEY,
  type CachedAuthUser
} from '~/utils/cachedAuth';

vi.unmock('~/composables/useAuth');

type TestState<T> = { value: T };
const mockState = vi.hoisted(() => ({} as Record<string, TestState<unknown>>));
const localState = mockState;

const mockUseState = vi.hoisted(() => {
  return vi.fn((key: string, init?: () => unknown) => {
    if (!mockState[key]) {
      mockState[key] = { value: init ? init() : null };
    }
    return mockState[key] as TestState<unknown>;
  });
});

vi.stubGlobal('useState', mockUseState);
vi.stubGlobal('useRequestHeaders', vi.fn(() => ({})));

const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

vi.mock('#app', () => ({
  useState: mockUseState,
  useRequestHeaders: () => ({})
}));

vi.mock('nuxt/app', () => ({
  useState: mockUseState,
  useRequestHeaders: () => ({})
}));

vi.mock('#imports', () => ({
  useState: mockUseState,
  useRequestHeaders: () => ({})
}));

vi.mock('#app/composables/state', () => ({
  useState: mockUseState
}));

const mockStorageState: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorageState[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorageState[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorageState[key];
  }),
  clear: vi.fn(() => {
    for (const key in mockStorageState) {
      delete mockStorageState[key];
    }
  }),
  get length() {
    return Object.keys(mockStorageState).length;
  },
  key: vi.fn((index: number) => Object.keys(mockStorageState)[index] ?? null)
};
vi.stubGlobal('localStorage', mockLocalStorage);

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const key in localState) {
      delete localState[key];
    }
    vi.restoreAllMocks();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  it('should initialize user as null and not read localStorage during synchronous setup', () => {
    const getItemSpy = vi.spyOn(localStorage, 'getItem');
    cacheAuthUser(localStorage, { id: '1', email: 'test@example.com', username: 'test' });
    getItemSpy.mockClear();

    const { user } = useAuth();
    expect(user.value).toBeNull();
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it('should clear user state and localStorage on 401 error', async () => {
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = cachedUser;

    mockFetch.mockRejectedValue({
      status: 401,
      statusMessage: 'Unauthorized'
    });

    await fetchUser();
    expect(user.value).toBeNull();
    expect(getCachedAuthUser(localStorage)).toBeNull();
  });

  it('should clear user state and localStorage on 403 error', async () => {
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = cachedUser;

    mockFetch.mockRejectedValue({
      status: 403,
      statusMessage: 'Forbidden'
    });

    await fetchUser();
    expect(user.value).toBeNull();
    expect(getCachedAuthUser(localStorage)).toBeNull();
  });

  it('should restore user state from localStorage when fetch fails with a network error (no status)', async () => {
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = null;

    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await fetchUser();
    expect(user.value).toEqual(cachedUser);
  });

  it('should restore user state from localStorage when navigator is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = null;

    mockFetch.mockRejectedValue({
      name: 'FetchError',
      message: 'Unreachable'
    });

    await fetchUser();
    expect(user.value).toEqual(cachedUser);
  });

  it('should not restore cached auth on 500 server error', async () => {
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = null;

    mockFetch.mockRejectedValue({
      status: 500,
      statusMessage: 'Internal Server Error'
    });

    await fetchUser();
    expect(user.value).toBeNull();
  });

  it('should not restore cached auth on 500 even when navigator is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = null;

    mockFetch.mockRejectedValue({
      status: 500,
      statusMessage: 'Internal Server Error'
    });

    await fetchUser();
    expect(user.value).toBeNull();
  });

  it('should not restore cached auth on arbitrary online null-status error', async () => {
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = null;

    mockFetch.mockRejectedValue(new Error('Arbitrary application error'));

    await fetchUser();
    expect(user.value).toBeNull();
  });

  it('should not restore cached auth on pending server logout even if offline', async () => {
    const cachedUser = { id: '1', email: 'test@example.com', username: 'test' };
    cacheAuthUser(localStorage, cachedUser);
    localStorage.setItem(AUTH_PENDING_SERVER_LOGOUT_KEY, String(Date.now()));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const { user, fetchUser } = useAuth();
    (user as Ref<CachedAuthUser | null>).value = cachedUser;

    await fetchUser();
    expect(user.value).toBeNull();
    expect(getCachedAuthUser(localStorage)).toBeNull();
  });
});
