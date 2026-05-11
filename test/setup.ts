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
  useSeoMeta: vi.fn(),
  useHead: vi.fn(),
  definePageMeta: vi.fn(),
}));

vi.mock('nuxt/app', () => ({
  useState: useStateMock,
  useNuxtApp: useNuxtAppMock,
  useRequestHeaders: vi.fn(() => ({})),
  useSeoMeta: vi.fn(),
  useHead: vi.fn(),
  definePageMeta: vi.fn(),
}));

vi.mock('~/composables/useAuth', () => ({
  useAuth: useAuthMock
}));

vi.stubGlobal('useState', useStateMock);
vi.stubGlobal('useAuth', useAuthMock);
vi.stubGlobal('useNuxtApp', useNuxtAppMock);

vi.mock('@unhead/vue', () => ({
  useSeoMeta: vi.fn(),
  useHead: vi.fn(),
  injectHead: vi.fn(() => ({
    push: vi.fn(),
    resolveTags: vi.fn(() => []),
  })),
  createHead: vi.fn(() => ({
    install: vi.fn(),
    push: vi.fn(),
  })),
}));

// Mock $fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

// Mock SEO and Meta functions
vi.stubGlobal('useSeoMeta', vi.fn());
vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('nextTick', (fn: any) => Promise.resolve().then(fn));

export { mockFetch };
