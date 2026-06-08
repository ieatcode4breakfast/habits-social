import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HELP_PATH } from '~/utils/helpCenter';
import { useHelpModal } from './useHelpModal';

interface TestRef<T> {
  value: T;
}

const mocks = vi.hoisted(() => {
  const state = {
    isOpen: { value: false },
    activePath: { value: '/help-center/welcome' }
  };

  const useStateMock = vi.fn((key: string, init: () => boolean | string) => {
    if (key === 'help-modal-open') {
      if (typeof state.isOpen.value !== 'boolean') state.isOpen.value = Boolean(init());
      return state.isOpen;
    }

    if (key === 'help-modal-active-path') {
      if (typeof state.activePath.value !== 'string') state.activePath.value = String(init());
      return state.activePath;
    }

    return { value: init() };
  });

  return {
    state,
    useStateMock
  };
});

vi.mock('#app', () => ({
  useState: mocks.useStateMock
}));

describe('useHelpModal', () => {
  beforeEach(() => {
    mocks.state.isOpen.value = false;
    mocks.state.activePath.value = DEFAULT_HELP_PATH;
    vi.clearAllMocks();
  });

  it('starts closed at the welcome article', () => {
    const modal = useHelpModal();

    expect(modal.isOpen.value).toBe(false);
    expect(modal.activePath.value).toBe(DEFAULT_HELP_PATH);
  });

  it('opens and closes without mutating router history', () => {
    const modal = useHelpModal();

    modal.open('/help-center/buckets');

    expect(modal.isOpen.value).toBe(true);
    expect(modal.activePath.value).toBe('/help-center/buckets');

    modal.close();

    expect(modal.isOpen.value).toBe(false);
  });

  it('falls back for invalid paths and preserves internal hashes', () => {
    const modal = useHelpModal();

    modal.open('/habits');
    expect(modal.activePath.value).toBe(DEFAULT_HELP_PATH);

    modal.open('/help-center/my-habits#key-rules');
    expect(modal.activePath.value).toBe('/help-center/my-habits#key-rules');
  });

  it('exposes refs with the expected value shapes', () => {
    const modal = useHelpModal();
    const isOpen: TestRef<boolean> = modal.isOpen;
    const activePath: TestRef<string> = modal.activePath;

    expect(isOpen.value).toBe(false);
    expect(activePath.value).toBe(DEFAULT_HELP_PATH);
  });
});
