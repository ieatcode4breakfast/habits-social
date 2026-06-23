import { ref, computed } from 'vue';
import { useNetwork } from '@vueuse/core';
import { habitsApi } from '~/utils/apiClient';

interface VapidPublicKeyResponse {
  supported: boolean;
  publicKey?: string;
}

const isSupported = ref(false);
const isPermissionGranted = ref(false);
const isPermissionDenied = ref(false);
const isSubscribing = ref(false);
const isSubscribed = ref(false);
const isPushConfigured = ref(false);
const vapidPublicKey = ref<string | null>(null);
const subscriptionState = ref<'loading' | 'supported' | 'unsupported' | 'denied'>('loading');
let initialized = false;

export function useChatNotifications() {
  const { isOnline } = useNetwork();

  const canSubscribe = computed(() => {
    return isSupported.value
      && isPushConfigured.value
      && !!vapidPublicKey.value
      && isOnline.value
      && !isPermissionDenied.value
      && !isSubscribing.value;
  });

  async function init(): Promise<void> {
    if (initialized) return;
    initialized = true;

    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      subscriptionState.value = 'unsupported';
      return;
    }

    isSupported.value = true;

    try {
      const registration = await navigator.serviceWorker.ready;
      const config = await habitsApi<VapidPublicKeyResponse>('/api/push/vapid-public-key');

      if (!config.supported || !config.publicKey) {
        isPushConfigured.value = false;
        subscriptionState.value = 'unsupported';
        return;
      }

      isPushConfigured.value = true;
      vapidPublicKey.value = config.publicKey;

      const permission = Notification.permission;
      if (permission === 'denied') {
        isPermissionDenied.value = true;
        subscriptionState.value = 'denied';
        return;
      }

      isPermissionGranted.value = permission === 'granted';

      if (permission === 'granted') {
        subscriptionState.value = 'supported';
        await syncExistingSubscription(registration);
      } else {
        subscriptionState.value = 'supported';
      }
    } catch {
      subscriptionState.value = 'unsupported';
    }
  }

  async function syncExistingSubscription(registration?: ServiceWorkerRegistration): Promise<void> {
    try {
      const reg = registration || await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const subJson = existing.toJSON();
        if (subJson.endpoint && subJson.keys) {
          await habitsApi('/api/push/subscriptions', {
            method: 'POST',
            body: {
              endpoint: subJson.endpoint,
              keys: subJson.keys,
              expirationTime: subJson.expirationTime || null,
            },
          });
          isSubscribed.value = true;
        }
      }
    } catch {
      // Best-effort sync; failure is non-critical
    }
  }

  async function requestPermission(): Promise<boolean> {
    if (!canSubscribe.value) return false;

    try {
      isSubscribing.value = true;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        isPermissionDenied.value = true;
        subscriptionState.value = 'denied';
        isSubscribing.value = false;
        return false;
      }

      isPermissionGranted.value = true;
      const registration = await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await syncExistingSubscription(registration);
        isSubscribed.value = true;
        isSubscribing.value = false;
        return true;
      }

      const keyBytes = urlBase64ToUint8Array(vapidPublicKey.value!);
      const applicationServerKey: Uint8Array<ArrayBuffer> = new Uint8Array(keyBytes.buffer as ArrayBuffer);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJson = subscription.toJSON();
      await habitsApi('/api/push/subscriptions', {
        method: 'POST',
        body: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          expirationTime: subJson.expirationTime || null,
        },
      });

      isSubscribed.value = true;
      isSubscribing.value = false;
      return true;
    } catch {
      isSubscribing.value = false;
      return false;
    }
  }

  async function unsubscribe(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const subJson = existing.toJSON();
        if (subJson.endpoint) {
          try {
            await habitsApi('/api/push/subscriptions', {
              method: 'DELETE',
              body: { endpoint: subJson.endpoint },
            });
          } catch {
            // Best-effort server cleanup
          }
        }
        await existing.unsubscribe();
        isSubscribed.value = false;
      }
    } catch {
      // Best-effort
    }
  }

  return {
    isSupported,
    isPermissionGranted,
    isPermissionDenied,
    isSubscribing,
    isSubscribed,
    isPushConfigured,
    canSubscribe,
    subscriptionState,
    init,
    requestPermission,
    unsubscribe,
    syncExistingSubscription,
  };
}

export function _resetChatNotificationState(): void {
  isSupported.value = false;
  isPermissionGranted.value = false;
  isPermissionDenied.value = false;
  isSubscribing.value = false;
  isPushConfigured.value = false;
  isSubscribed.value = false;
  vapidPublicKey.value = null;
  subscriptionState.value = 'loading';
  initialized = false;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
