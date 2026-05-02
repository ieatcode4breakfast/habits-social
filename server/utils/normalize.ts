import { format } from 'date-fns';

export const normalizeLog = (log: any) => {
  if (!log) return log;
  const normalized = { ...log };
  if (normalized.date) {
    normalized.date = format(new Date(normalized.date), 'yyyy-MM-dd');
  }
  return normalized;
};

export const normalizeHabit = (h: any) => {
  if (!h) return h;
  const normalized = { ...h };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = format(new Date(normalized.streakAnchorDate), 'yyyy-MM-dd');
  }
  return normalized;
};

export const normalizeBucket = (b: any) => {
  if (!b) return b;
  const normalized = { ...b };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = format(new Date(normalized.streakAnchorDate), 'yyyy-MM-dd');
  }
  return normalized;
};
