export function shouldRefreshFeed(
  lastFetchTimestamp: number,
  currentFeedLength: number,
  isForced: boolean,
  staleThresholdMs: number,
  currentTimestamp: number = Date.now()
): boolean {
  if (isForced) return true;
  if (currentFeedLength === 0) return true;
  if (currentTimestamp - lastFetchTimestamp > staleThresholdMs) return true;
  return false;
}
