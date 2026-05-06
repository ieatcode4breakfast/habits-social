// UTC date normalization helper
const toUTCDateString = (date: any) => {
  if (!date) return date;
  return new Date(date).toISOString().split('T')[0];
};

export const normalizeHabit = (h: any) => {
  if (!h) return h;
  const normalized = { ...h };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = toUTCDateString(normalized.streakAnchorDate);
  }
  return normalized;
};

export const normalizeBucket = (b: any) => {
  if (!b) return b;
  const normalized = { ...b };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = toUTCDateString(normalized.streakAnchorDate);
  }
  return normalized;
};

export const normalizeLog = (log: any) => {
  if (!log) return log;
  const normalized = { ...log };
  if (normalized.date) {
    normalized.date = toUTCDateString(normalized.date);
  }
  return normalized;
};
