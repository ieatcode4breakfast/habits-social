const toUTCDateString = (date: any) => {
  if (!date) return date;
  return new Date(date).toISOString().split('T')[0];
};

export const normalizeUser = (u: any) => {
  if (!u) return u;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    photoUrl: u.photo_url ?? u.photourl ?? u.photoUrl,
    createdAt: u.created_at ?? u.createdat ?? u.createdAt,
    updatedAt: u.updated_at ?? u.updatedat ?? u.updatedAt,
    emailVerifiedAt: u.email_verified_at ?? u.emailVerifiedAt ?? null
  };
};

export const normalizeHabit = (h: any) => {
  if (!h) return h;
  const normalized = { 
    ...h,
    ownerId: h.owner_id ?? h.ownerid ?? h.ownerId,
    sharedWith: h.shared_with ?? h.sharedwith ?? h.sharedWith,
    updatedAt: h.updated_at ?? h.updatedat ?? h.updatedAt,
    createdAt: h.created_at ?? h.createdat ?? h.createdAt,
    userDate: h.user_date ?? h.userDate,
    skipsCount: h.skips_count ?? h.skipsCount,
    skipsPeriod: h.skips_period ?? h.skipsPeriod,
    sortOrder: h.sort_order ?? h.sortOrder,
    currentStreak: h.current_streak ?? h.currentStreak,
    longestStreak: h.longest_streak ?? h.longestStreak,
    streakAnchorDate: h.streak_anchor_date ?? h.streakAnchorDate
  };
  
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = toUTCDateString(normalized.streakAnchorDate);
  }
  
  // Clean up all possible variants
  const toDelete = [
    'ownerid', 'owner_id', 'sharedwith', 'shared_with', 'updatedat', 'updated_at', 
    'createdat', 'created_at', 'user_date', 'skips_count', 'skips_period', 
    'sort_order', 'current_streak', 'longest_streak', 'streak_anchor_date'
  ];
  toDelete.forEach(key => delete (normalized as any)[key]);
  
  return normalized;
};

export const normalizeBucket = (b: any) => {
  if (!b) return b;
  const normalized = { 
    ...b,
    ownerId: b.owner_id ?? b.ownerid ?? b.ownerId,
    updatedAt: b.updated_at ?? b.updatedat ?? b.updatedAt,
    createdAt: b.created_at ?? b.createdat ?? b.createdAt,
    sortOrder: b.sort_order ?? b.sortOrder,
    currentStreak: b.current_streak ?? b.currentStreak,
    longestStreak: b.longest_streak ?? b.longestStreak,
    streakAnchorDate: b.streak_anchor_date ?? b.streakAnchorDate
  };
  
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = toUTCDateString(normalized.streakAnchorDate);
  }

  // Clean up
  const toDelete = [
    'ownerid', 'owner_id', 'updatedat', 'updated_at', 'createdat', 'created_at',
    'sort_order', 'current_streak', 'longest_streak', 'streak_anchor_date'
  ];
  toDelete.forEach(key => delete (normalized as any)[key]);

  return normalized;
};

export const normalizeLog = (log: any) => {
  if (!log) return log;
  const normalized = { 
    ...log,
    habitId: log.habit_id ?? log.habitid ?? log.habitId,
    bucketId: log.bucket_id ?? log.bucketid ?? log.bucketId,
    ownerId: log.owner_id ?? log.ownerid ?? log.ownerId,
    sharedWith: log.shared_with ?? log.sharedwith ?? log.sharedWith,
    updatedAt: log.updated_at ?? log.updatedat ?? log.updatedAt,
    streakCount: log.streak_count ?? log.streakCount,
    brokenStreakCount: log.broken_streak_count ?? log.brokenStreakCount
  };
  
  if (normalized.date) {
    normalized.date = toUTCDateString(normalized.date);
  }

  // Clean up
  const toDelete = [
    'habitid', 'habit_id', 'bucketid', 'bucket_id', 'ownerid', 'owner_id', 
    'sharedwith', 'shared_with', 'updatedat', 'updated_at', 'streak_count', 'broken_streak_count'
  ];
  toDelete.forEach(key => delete (normalized as any)[key]);

  return normalized;
};
