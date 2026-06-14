export const TUTORIAL_STORAGE_PREFIX = 'habits-social:tutorial:initial:v1:';
export const BUCKET_TUTORIAL_STORAGE_PREFIX = 'habits-social:tutorial:buckets:v1:';
export const SOCIAL_TUTORIAL_STORAGE_PREFIX = 'habits-social:tutorial:social:v1:';

export interface TutorialFlag {
  status: 'completed';
  completedAt: string;
}

const isTutorialFlag = (value: unknown): value is TutorialFlag => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.status === 'completed' && typeof record.completedAt === 'string';
};

const getTutorialFlagWithPrefix = (userId: string, prefix: string): TutorialFlag | null => {
  try {
    const raw = localStorage.getItem(`${prefix}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isTutorialFlag(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const setTutorialFlagWithPrefix = (userId: string, prefix: string): void => {
  try {
    const flag: TutorialFlag = {
      status: 'completed',
      completedAt: new Date().toISOString()
    };
    localStorage.setItem(`${prefix}${userId}`, JSON.stringify(flag));
  } catch {
    // localStorage unavailable, silently ignore
  }
};

export const getTutorialFlag = (userId: string): TutorialFlag | null => {
  return getTutorialFlagWithPrefix(userId, TUTORIAL_STORAGE_PREFIX);
};

export const isTutorialCompleted = (userId: string): boolean => {
  return getTutorialFlag(userId) !== null;
};

export const setTutorialCompleted = (userId: string): void => {
  setTutorialFlagWithPrefix(userId, TUTORIAL_STORAGE_PREFIX);
};

export const isBucketTutorialCompleted = (userId: string): boolean => {
  return getTutorialFlagWithPrefix(userId, BUCKET_TUTORIAL_STORAGE_PREFIX) !== null;
};

export const setBucketTutorialCompleted = (userId: string): void => {
  setTutorialFlagWithPrefix(userId, BUCKET_TUTORIAL_STORAGE_PREFIX);
};

export const isSocialTutorialCompleted = (userId: string): boolean => {
  return getTutorialFlagWithPrefix(userId, SOCIAL_TUTORIAL_STORAGE_PREFIX) !== null;
};

export const setSocialTutorialCompleted = (userId: string): void => {
  setTutorialFlagWithPrefix(userId, SOCIAL_TUTORIAL_STORAGE_PREFIX);
};
