import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getTutorialFlag, isTutorialCompleted, setTutorialCompleted, TUTORIAL_STORAGE_PREFIX } from './tutorialFlags';

const STORAGE = () => `${TUTORIAL_STORAGE_PREFIX}user-a`;
const OTHER_USER_KEY = () => `${TUTORIAL_STORAGE_PREFIX}user-b`;

const setupLocalStorage = () => {
  const store: Record<string, string> = {};
  const mockLS = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
  vi.stubGlobal('localStorage', mockLS);
  return mockLS;
};

describe('tutorialFlags', () => {
  let ls: ReturnType<typeof setupLocalStorage>;

  beforeEach(() => {
    ls = setupLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setTutorialCompleted', () => {
    it('stores completion per user and tutorial version', () => {
      setTutorialCompleted('user-a');

      const stored = ls.getItem(STORAGE());
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toMatchObject({
        status: 'completed'
      });
      expect(typeof parsed.completedAt).toBe('string');
    });

    it('does not share state between users', () => {
      setTutorialCompleted('user-a');
      setTutorialCompleted('user-b');

      expect(ls.getItem(STORAGE())).not.toBeNull();
      expect(ls.getItem(OTHER_USER_KEY())).not.toBeNull();

      expect(isTutorialCompleted('user-a')).toBe(true);
      expect(isTutorialCompleted('user-b')).toBe(true);
      expect(isTutorialCompleted('user-c')).toBe(false);
    });
  });

  describe('getTutorialFlag', () => {
    it('returns null when no flag is stored', () => {
      expect(getTutorialFlag('user-a')).toBeNull();
    });

    it('returns the flag when stored', () => {
      setTutorialCompleted('user-a');
      const flag = getTutorialFlag('user-a');
      expect(flag).not.toBeNull();
      expect(flag!.status).toBe('completed');
      expect(flag!.completedAt).toBeTruthy();
    });
  });

  describe('isTutorialCompleted', () => {
    it('returns true after completion', () => {
      setTutorialCompleted('user-a');
      expect(isTutorialCompleted('user-a')).toBe(true);
    });

    it('returns false when not completed', () => {
      expect(isTutorialCompleted('user-a')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('handles malformed stored JSON safely', () => {
      ls.setItem(STORAGE(), '{bad json');
      expect(getTutorialFlag('user-a')).toBeNull();
      expect(isTutorialCompleted('user-a')).toBe(false);
    });

    it('handles JSON with unexpected shape safely', () => {
      ls.setItem(STORAGE(), JSON.stringify({ foo: 'bar' }));
      expect(getTutorialFlag('user-a')).toBeNull();
    });

    it('handles JSON with wrong status value', () => {
      ls.setItem(STORAGE(), JSON.stringify({ status: 'not-done', completedAt: '2024-01-01' }));
      expect(getTutorialFlag('user-a')).toBeNull();
    });

    it('handles unavailable localStorage without crashing', () => {
      vi.spyOn(ls, 'getItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      expect(getTutorialFlag('user-a')).toBeNull();
      expect(isTutorialCompleted('user-a')).toBe(false);
    });

    it('handles throwing localStorage on setItem without crashing', () => {
      vi.spyOn(ls, 'setItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      expect(() => setTutorialCompleted('user-a')).not.toThrow();
    });
  });
});
