import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock nativeAuthToken to avoid Capacitor dynamic imports in the test environment.
vi.mock('./nativeAuthToken', () => ({
  getNativeAuthToken: vi.fn().mockResolvedValue(null),
}));

import { habitsApi, resetApiClientRuntimeCache } from './apiClient';

/**
 * Self-check: habitsApi() must take the native branch (absolute URL) when
 * runtimeConfig.public.build === 'native', and the web branch (relative URL)
 * otherwise. This is the exact logic that was broken when getRuntimeConfigPublic()
 * read window.__NUXT__ directly — Nuxt deletes that post-hydration on Android,
 * so build came back undefined and every request went to https://localhost/api/...
 */
describe('habitsApi runtime config detection', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetApiClientRuntimeCache();
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('$fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses absolute apiBaseUrl when build is native', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { build: 'native', apiBaseUrl: 'https://staging.example.com' },
    }));

    await habitsApi('/api/test', { authRequired: false });

    const call = fetchMock.mock.calls[0] ?? [];
    expect(call[0]).toBe('https://staging.example.com/api/test');
  });

  it('uses relative URL when build is web', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { build: 'web', apiBaseUrl: '' },
    }));

    await habitsApi('/api/test', { authRequired: false });

    const call = fetchMock.mock.calls[0] ?? [];
    expect(call[0]).toBe('/api/test');
  });
});
