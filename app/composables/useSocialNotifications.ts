import { useSocial } from './useSocial';

export interface SocialNotificationOptions {
  onFriendRequestReceived?: (data: any) => void;
  onFriendRequestAccepted?: (data: any) => void;
  onFriendshipRemoved?: (data: any) => void;
}

export const useSocialNotifications = (options?: SocialNotificationOptions) => {
  const { pendingCount, refresh, init: initSocial, cleanup: cleanupSocial } = useSocial();

  // Note: The options callbacks are not currently triggered by useSocial's internal refresh.
  // In most cases, these were used to trigger a local load() in components.
  // Since useSocial now manages the state globally, those local load() calls might be redundant
  // or should be replaced with reactive state from useSocial.
  
  const init = () => {
    initSocial();
  };

  const cleanup = () => {
    cleanupSocial();
  };

  return {
    pendingCount,
    refreshCount: refresh,
    init,
    cleanup
  };
};
