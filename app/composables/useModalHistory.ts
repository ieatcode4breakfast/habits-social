import { watch, onMounted, onUnmounted, type Ref } from 'vue';

/**
 * Intercepts the browser back button to close a modal instead of navigating away.
 * Uses history.pushState to create a dummy entry that can be popped.
 */
export const useModalHistory = (isOpen: Ref<boolean>, onClose?: () => boolean | void) => {
  if (import.meta.server) return;

  const modalKey = `modal-${Math.random().toString(36).substring(2, 9)}`;
  let modalStatePushed = false;

  const handlePopState = (event: PopStateEvent) => {
    // If the modal is open and the state we landed on doesn't have OUR specific key,
    // it means the user pressed back (or history.back() was called).
    if (isOpen.value && modalStatePushed && !event.state?.[modalKey]) {
      // If onClose returns false, it means the close was vetoed (e.g., unsaved changes)
      const canClose = onClose ? onClose() : true;

      if (canClose === false) {
        // Re-push the state to restore history and keep the modal open.
        // Use a small delay to ensure the browser has finished processing the current popstate.
        setTimeout(() => {
          const currentState = window.history.state || {};
          window.history.pushState({ ...currentState, [modalKey]: true }, '');
        }, 10);
      } else {
        modalStatePushed = false;
        isOpen.value = false;
      }
    }
  };

  watch(isOpen, (open, wasOpen) => {
    if (open && !wasOpen) {
      // Modal opened: push a unique key for this modal, preserving other state
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, [modalKey]: true }, '');
      modalStatePushed = true;
    } else if (!open && wasOpen && modalStatePushed) {
      modalStatePushed = false;
      // Only pop if the current top state still belongs to us
      if (window.history.state?.[modalKey]) {
        window.history.back();
      }
    }
  });

  onMounted(() => {
    window.addEventListener('popstate', handlePopState);
  });

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState);
    if (modalStatePushed && window.history.state?.[modalKey]) {
      modalStatePushed = false;
      window.history.back();
    }
  });
};
