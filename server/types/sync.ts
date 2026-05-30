export interface SyncParams {
  lastSynced?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursors?: Record<string, string>;
}

export interface HabitStreakBaseline {
  habitId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  baselineDate: string;
  baselineCurrentStreak: number;
  baselineLongestStreak: number;
  baselineStreakAnchorDate: string | null;
}

export interface SyncResponse {
  habits: any[];
  buckets: any[];
  habitLogs: any[];
  bucketLogs: any[];
  deletions: Array<{ id: string; type: string }>;
  habitStreakBaselines?: HabitStreakBaseline[];
  serverTime: number;
  nextCursors?: Record<string, string>;
  hasMore?: boolean;
  forceUpdateRequired?: boolean;
}
