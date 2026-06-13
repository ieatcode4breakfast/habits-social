export const TUTORIAL_STORAGE_PREFIX = 'habits-social:tutorial:my-habits:v1:';

export interface TutorialFlag {
  status: 'completed';
  completedAt: string;
}

const isTutorialFlag = (value: unknown): value is TutorialFlag => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.status === 'completed' && typeof record.completedAt === 'string';
};

export const getTutorialFlag = (userId: string): TutorialFlag | null => {
  try {
    const raw = localStorage.getItem(`${TUTORIAL_STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isTutorialFlag(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const isTutorialCompleted = (userId: string): boolean => {
  return getTutorialFlag(userId) !== null;
};

export const setTutorialCompleted = (userId: string): void => {
  try {
    const flag: TutorialFlag = {
      status: 'completed',
      completedAt: new Date().toISOString()
    };
    localStorage.setItem(`${TUTORIAL_STORAGE_PREFIX}${userId}`, JSON.stringify(flag));
  } catch {
    // localStorage unavailable, silently ignore
  }
};
