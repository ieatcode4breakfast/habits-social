import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock Nuxt composables before any other imports
const mockState: Record<string, any> = {};

const useStateMock = vi.fn((key, init) => {
  if (!mockState[key]) mockState[key] = { value: init ? init() : null };
  return mockState[key];
});

const useAuthMock = vi.fn(() => ({
  user: { value: { id: 'test-user-id', email: 'test@example.com' } }
}));

const useNuxtAppMock = vi.fn(() => ({
  payload: { state: {} },
  runWithContext: (fn: any) => fn()
}));

vi.mock('#app', () => ({
  useState: useStateMock,
  useNuxtApp: useNuxtAppMock,
  useRequestHeaders: vi.fn(() => ({})),
}));

vi.mock('nuxt/app', () => ({
  useState: useStateMock,
  useNuxtApp: useNuxtAppMock,
  useRequestHeaders: vi.fn(() => ({})),
}));

vi.mock('~/composables/useAuth', () => ({
  useAuth: useAuthMock
}));

vi.stubGlobal('useState', useStateMock);
vi.stubGlobal('useAuth', useAuthMock);
vi.stubGlobal('useNuxtApp', useNuxtAppMock);

// Mock $fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

export { mockFetch };
