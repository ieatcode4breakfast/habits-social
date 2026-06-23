/**
 * Native persistent storage plugin.
 *
 * Requests persistent storage on Android to reduce the chance of the browser
 * evicting IndexedDB data under storage pressure. Runs once at startup and
 * does not block app initialization.
 *
 * ponytail: client-only plugin; web runtime skips silently (navigator.storage.persist
 * is a no-op in standard browser contexts where persistent storage isn't grantable).
 */
export default defineNuxtPlugin(async () => {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Best-effort; failure does not block the app.
  }
});
