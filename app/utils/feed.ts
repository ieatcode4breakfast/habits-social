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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatActivityMessageInline(message: string): string {
  if (!message) return '';

  return escapeHtml(message)
    .replace(/\[H\](.*?)\[\/H\]/g, '<strong class="font-bold">$1</strong>')
    .replace(/\[U:(.*?)\](.*?)\[\/U\]/g, '<span class="font-bold">$2</span>')
    .replace(/\[U\](.*?)\[\/U\]/g, '<strong class="font-bold">$1</strong>')
    .replace(/\[S:(\d+)(?::(broken))?\](.*?)\[\/S\]/g, '<strong class="font-bold">$3</strong>');
}
