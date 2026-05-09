export interface SyncParams {
  lastSynced?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursors?: Record<string, string>;
}

export interface SyncResponse {
  habits: any[];
  buckets: any[];
  habitLogs: any[];
  bucketLogs: any[];
  deletions: Array<{ id: string; type: string }>;
  serverTime: number;
  nextCursors?: Record<string, string>;
  hasMore?: boolean;
  forceUpdateRequired?: boolean;
}
