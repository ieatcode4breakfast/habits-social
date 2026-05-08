export interface SyncParams {
  lastSynced?: number;
  startDate?: string;
  endDate?: string;
}

export interface SyncResponse {
  habits: any[];
  buckets: any[];
  habitLogs: any[];
  bucketLogs: any[];
  deletions: Array<{ id: string; type: string }>;
  serverTime: number;
}
