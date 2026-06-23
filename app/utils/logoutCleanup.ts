/**
 * Centralized logout/account-deletion cleanup.
 *
 * Clears all local client state: native secure token, cached auth profile,
 * Dexie offline database, web push subscriptions, and native notifications.
 *
 * ponytail: best-effort push/notification cleanup; failure is non-critical
 * and individual callers already handle their own auth redirect flow.
 */

import { clearNativeAuthToken, resetNativeAuthRuntimeCache } from './nativeAuthToken';
import { resetApiClientRuntimeCache } from './apiClient';
import { clearCachedAuthUser, clearPendingServerLogout } from './cachedAuth';

export interface LogoutCleanupOptions {
  /** Clear the entire Dexie offline database (habits, logs, sync state). */
  clearDexie?: boolean;
  /** Best-effort unsubscribe from web push notifications. */
  unsubscribePush?: boolean;
  /** Best-effort clear delivered native Android notifications. */
  clearNotifications?: boolean;
}

export const logoutCleanup = async (options: LogoutCleanupOptions = {}): Promise<void> => {
  // 1. Clear native secure JWT token (Android Keystore)
  await clearNativeAuthToken();

  // 2. Clear cached auth profile and pending logout marker from localStorage
  try {
    clearCachedAuthUser(localStorage);
    clearPendingServerLogout(localStorage);
  } catch {
    // localStorage unavailable (SSR or sandboxed environment)
  }

  // 3. Clear Dexie offline database (habits, logs, buckets, sync state)
  if (options.clearDexie) {
    try {
      const { db } = await import('./db');
      await Promise.all([
        db.habits.clear(),
        db.habitLogs.clear(),
        db.buckets.clear(),
        db.bucketLogs.clear(),
        db.habitStreakBaselines.clear(),
        db.bucketStreakBaselines.clear(),
        db.syncQueue.clear(),
        db.syncState.clear(),
      ]);
    } catch {
      // Dexie unavailable (non-browser context)
    }
  }

  // 4. Best-effort unsubscribe from web push
  if (options.unsubscribePush) {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }
    } catch {
      // Push API unavailable or permission denied
    }
  }

  // 5. Best-effort clear delivered native Android notifications
  if (options.clearNotifications) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        // ponytail: try Capacitor Push Notifications plugin for notification cleanup.
        // If the plugin exposes a removeAllDeliveredNotifications or similar method,
        // call it. This gracefully handles the plugin not being available.
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          // ponytail: cast to access a best-effort clear method that may not exist at runtime.
          const pn = PushNotifications as unknown as {
            removeAllDeliveredNotifications?: () => Promise<void>;
          };
          if (typeof pn.removeAllDeliveredNotifications === 'function') {
            await pn.removeAllDeliveredNotifications();
          }
        } catch {
          // Plugin not available or method not exposed — non-critical.
        }
      }
    } catch {
      // Capacitor not available (web context)
    }
  }

  // 6. Reset runtime caches so the next auth check re-evaluates native vs web
  resetApiClientRuntimeCache();
  resetNativeAuthRuntimeCache();
};
